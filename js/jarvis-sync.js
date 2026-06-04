/* ──────────────────────────────────────────────────────────────
   자비스 기기 간 동기화 모듈  (맥북 ↔ 핸드폰)

   우선순위:
   1) Firebase Realtime Database 설정이 있으면  → 실시간 양방향 동기화 (가장 견고)
   2) 없으면 → ntfy.sh (HTTPS 443, 가입·설정 불필요) 로 실시간 동기화  ← 기본값
   3) ntfy 불가 시 → 공개 MQTT 브로커 (best-effort)
   4) 모두 불가 시 → 이 기기 localStorage 에만 저장 (안전한 폴백)

   같은 boardId 를 쓰는 기기끼리 동기화됩니다. (js/firebase-config.js 의 boardId)
   ────────────────────────────────────────────────────────────── */
(function (global) {
  'use strict';

  var LS_KEY = 'jarvis-tasks';
  var listeners = [];
  var statusCb = null;
  var mode = 'local';            // 'cloud' | 'ntfy' | 'mqtt' | 'local'
  var applyingRemote = false;    // 원격 반영 중 되쓰기 방지

  // ntfy.sh : 가입 없이 HTTPS(443) 로 동작하는 공개 pub/sub. 제한적인 네트워크도 통과.
  var NTFY_BASE = 'https://ntfy.sh';
  var ntfyTopic = null;
  var ntfySse = null;

  // 공개 MQTT 브로커 목록 (가입 불필요, best-effort, 모두 WSS=HTTPS호환).
  // 앞에서부터 시도하고, 일정 시간 내 연결 안 되면 다음 브로커로 폴백.
  var MQTT_BROKERS = [
    'wss://broker.emqx.io:8084/mqtt',
    'wss://test.mosquitto.org:8081/mqtt'
  ];

  var fbRef = null;              // Firebase 참조
  var mqttClient = null;         // MQTT 클라이언트
  var mqttTopic = null;
  var mqttSeedTimer = null;
  var mqttGotMessage = false;

  function readLocal() {
    try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; }
    catch (e) { return {}; }
  }
  function writeLocal(state) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) {}
  }
  function notify(state, fromRemote) {
    listeners.forEach(function (fn) {
      try { fn(state, fromRemote); } catch (e) { console.error('[JarvisSync] listener 오류', e); }
    });
  }
  function setStatus(s) { if (statusCb) { try { statusCb(s, mode); } catch (e) {} } }

  function boardId() {
    var cfg = global.JARVIS_FIREBASE_CONFIG;
    return (cfg && cfg.boardId) ? cfg.boardId : 'caracal-board-2026';
  }

  function hasFirebaseConfig(cfg) {
    if (!cfg || !cfg.apiKey || !cfg.databaseURL) return false;
    if (cfg.apiKey.indexOf('여기에') !== -1) return false;
    if (cfg.databaseURL.indexOf('여기에') !== -1) return false;
    return true;
  }

  // ── 원격에서 받은 상태를 로컬에 병합/반영 ──
  function applyRemote(remote) {
    if (!remote || typeof remote !== 'object') return;
    var merged = readLocal();
    Object.keys(remote).forEach(function (k) { merged[k] = !!remote[k]; });
    applyingRemote = true;
    writeLocal(merged);
    notify(merged, true);
    applyingRemote = false;
    setStatus('synced');
  }

  // ═══════════════ Firebase 백엔드 ═══════════════
  function startFirebase(cfg) {
    try {
      var app = (global.firebase.apps && global.firebase.apps.length)
        ? global.firebase.app()
        : global.firebase.initializeApp(cfg);
      fbRef = global.firebase.database(app).ref('jarvis/' + boardId() + '/tasks');
      mode = 'cloud';
      setStatus('connecting');

      fbRef.on('value', function (snap) {
        var remote = snap.val();
        if (remote == null) {           // 클라우드 비어있음 → 이 기기 상태로 시드
          var local = readLocal();
          var keys = Object.keys(local);
          if (keys.length) {
            applyingRemote = true;
            keys.forEach(function (k) { fbRef.child(k).set(!!local[k]); });
            applyingRemote = false;
          }
          setStatus('synced');
          return;
        }
        applyRemote(remote);
      }, function (err) {
        console.warn('[JarvisSync] Firebase 연결 실패 → ntfy 시도', err);
        fbRef = null;
        startNtfyOrMqtt();
      });
      return true;
    } catch (e) {
      console.warn('[JarvisSync] Firebase 초기화 오류 → MQTT 시도', e);
      fbRef = null;
      return false;
    }
  }

  // ═══════════════ MQTT 백엔드 (무설정 기본값) ═══════════════
  function startMqtt() {
    if (typeof global.mqtt === 'undefined' || !global.mqtt.connect) return false;
    mqttTopic = 'jarvis/' + boardId() + '/tasks';
    mode = 'mqtt';
    connectBroker(0);
    return true;
  }

  // 브로커 하나에 연결 시도, 7초 내 실패하면 다음 브로커로 폴백
  function connectBroker(idx) {
    var url = MQTT_BROKERS[idx % MQTT_BROKERS.length];
    setStatus('connecting');

    var client;
    try {
      client = global.mqtt.connect(url, {
        clientId: 'jarvis_' + Math.random().toString(16).slice(2),
        clean: true,
        reconnectPeriod: 4000,
        connectTimeout: 6000,
        keepalive: 30
      });
    } catch (e) {
      console.warn('[JarvisSync] MQTT connect 예외 @' + url, e);
      return tryNext(idx);
    }

    var settled = false;
    var failTimer = setTimeout(function () {
      if (settled) return;
      settled = true;
      try { client.end(true); } catch (e) {}
      tryNext(idx);
    }, 7000);

    client.on('connect', function () {
      settled = true;
      clearTimeout(failTimer);
      mqttClient = client;
      mqttGotMessage = false;
      client.subscribe(mqttTopic, { qos: 1 }, function () {
        setStatus('synced');
        // 일정 시간 내 retained 메시지가 없으면(=최초) 이 기기 상태를 시드로 게시
        clearTimeout(mqttSeedTimer);
        mqttSeedTimer = setTimeout(function () {
          if (!mqttGotMessage) {
            var local = readLocal();
            if (Object.keys(local).length) publishState(local);
          }
        }, 2000);
      });
    });

    client.on('message', function (topic, payload) {
      mqttGotMessage = true;
      try { applyRemote(JSON.parse(payload.toString())); }
      catch (e) { console.warn('[JarvisSync] MQTT 메시지 파싱 실패', e); }
    });

    client.on('reconnect', function () { setStatus('connecting'); });
    client.on('error', function (e) { console.warn('[JarvisSync] MQTT 오류 @' + url, e && e.message); });
  }

  function tryNext(idx) {
    if (idx + 1 < MQTT_BROKERS.length) {
      connectBroker(idx + 1);          // 다음 브로커
    } else {
      console.warn('[JarvisSync] 모든 공개 브로커 연결 실패 → 로컬 저장 모드');
      mode = 'local';
      setStatus('local');
    }
  }

  function publishState(state) {
    if (mode === 'mqtt' && mqttClient && mqttClient.connected) {
      // retain:true → 나중에 접속하는 기기도 최신 상태를 즉시 받음
      mqttClient.publish(mqttTopic, JSON.stringify(state), { qos: 1, retain: true });
    }
  }

  function startMqttOrLocal() {
    if (!startMqtt()) {
      mode = 'local';
      setStatus('local');
    }
  }

  // ═══════════════ ntfy.sh 백엔드 (HTTPS 443, 무설정 기본값) ═══════════════
  function ntfyTopicName() { return 'caracal-jarvis-' + boardId(); }

  function startNtfy() {
    if (typeof global.fetch !== 'function' || typeof global.EventSource !== 'function') return false;
    ntfyTopic = ntfyTopicName();
    mode = 'ntfy';
    setStatus('connecting');

    // 1) 서버 캐시에 있는 최신 상태부터 가져오기 (retained 역할)
    global.fetch(NTFY_BASE + '/' + ntfyTopic + '/json?poll=1&since=12h')
      .then(function (r) { return r.text(); })
      .then(function (text) {
        var latest = null;
        text.split('\n').forEach(function (line) {
          if (!line) return;
          try { var o = JSON.parse(line); if (o.event === 'message' && o.message) latest = o.message; } catch (e) {}
        });
        if (latest) { try { applyRemote(JSON.parse(latest)); } catch (e) {} }
        else {
          var local = readLocal();           // 캐시가 비어있고 이 기기에 상태가 있으면 시드 게시
          if (Object.keys(local).length) publishNtfy(local);
        }
      })
      .catch(function (e) { console.warn('[JarvisSync] ntfy 초기 조회 실패', e); });

    // 2) 실시간 구독 (SSE, 자동 재연결)
    try {
      ntfySse = new global.EventSource(NTFY_BASE + '/' + ntfyTopic + '/sse');
      ntfySse.onopen = function () { setStatus('synced'); };
      ntfySse.onmessage = function (ev) {
        try {
          var o = JSON.parse(ev.data);
          if (o.event === 'message' && o.message) applyRemote(JSON.parse(o.message));
        } catch (e) {}
      };
      ntfySse.onerror = function () { setStatus('connecting'); };   // EventSource 가 자동 재시도
    } catch (e) {
      console.warn('[JarvisSync] ntfy SSE 오류 → MQTT 시도', e);
      return false;
    }
    return true;
  }

  function publishNtfy(state) {
    if (typeof global.fetch !== 'function') return;
    global.fetch(NTFY_BASE + '/' + ntfyTopic, { method: 'POST', body: JSON.stringify(state) })
      .catch(function (e) { console.warn('[JarvisSync] ntfy 게시 실패', e); });
  }

  function startNtfyOrMqtt() {
    if (!startNtfy()) startMqttOrLocal();
  }

  var Sync = {
    mode: function () { return mode; },
    onUpdate: function (fn) { if (typeof fn === 'function') listeners.push(fn); },
    onStatus: function (fn) { statusCb = fn; },
    getAll: function () { return readLocal(); },

    /** 체크 상태 변경 저장 + 전파 */
    set: function (id, checked) {
      var state = readLocal();
      state[id] = !!checked;
      writeLocal(state);
      if (applyingRemote) return;
      if (mode === 'cloud' && fbRef) {
        fbRef.child(id).set(!!checked).catch(function (e) {
          console.warn('[JarvisSync] Firebase 쓰기 실패 (로컬엔 저장됨)', e);
        });
      } else if (mode === 'ntfy') {
        publishNtfy(state);         // 전체 상태를 게시
      } else if (mode === 'mqtt') {
        publishState(state);        // 전체 상태를 retained 로 게시
      }
    },

    init: function () {
      // 우선 로컬 상태부터 화면에 반영
      notify(readLocal(), false);

      var cfg = global.JARVIS_FIREBASE_CONFIG;
      var fbReady = hasFirebaseConfig(cfg) &&
                    typeof global.firebase !== 'undefined' &&
                    typeof global.firebase.initializeApp === 'function';

      if (fbReady && startFirebase(cfg)) return;   // 1순위 Firebase
      startNtfyOrMqtt();                            // 2순위 ntfy → 3순위 MQTT → 4순위 local
    }
  };

  global.JarvisSync = Sync;
})(window);
