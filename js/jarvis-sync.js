/* ──────────────────────────────────────────────────────────────
   자비스 기기 간 동기화 모듈  (맥북 ↔ 핸드폰)

   우선순위:
   1) Firebase Realtime Database 설정이 있으면  → 실시간 양방향 동기화 (가장 견고)
   2) 없으면 → 공개 MQTT 브로커로 실시간 동기화 (가입·설정 불필요, 기본값)
   3) 둘 다 안 되면 → 이 기기 localStorage 에만 저장 (안전한 폴백)

   같은 boardId 를 쓰는 기기끼리 동기화됩니다. (js/firebase-config.js 의 boardId)
   ────────────────────────────────────────────────────────────── */
(function (global) {
  'use strict';

  var LS_KEY = 'jarvis-tasks';
  var listeners = [];
  var statusCb = null;
  var mode = 'local';            // 'cloud' | 'mqtt' | 'local'
  var applyingRemote = false;    // 원격 반영 중 되쓰기 방지

  // 공개 MQTT 브로커 (가입 불필요, best-effort). WebSocket Secure.
  var MQTT_BROKER = 'wss://broker.emqx.io:8084/mqtt';

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
        console.warn('[JarvisSync] Firebase 연결 실패 → MQTT 시도', err);
        fbRef = null;
        startMqttOrLocal();
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
    try {
      mqttTopic = 'jarvis/' + boardId() + '/tasks';
      mode = 'mqtt';
      setStatus('connecting');

      mqttClient = global.mqtt.connect(MQTT_BROKER, {
        clientId: 'jarvis_' + Math.random().toString(16).slice(2),
        clean: true,
        reconnectPeriod: 4000,
        connectTimeout: 8000,
        keepalive: 30
      });

      mqttClient.on('connect', function () {
        mqttGotMessage = false;
        mqttClient.subscribe(mqttTopic, { qos: 1 }, function () {
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

      mqttClient.on('message', function (topic, payload) {
        mqttGotMessage = true;
        try { applyRemote(JSON.parse(payload.toString())); }
        catch (e) { console.warn('[JarvisSync] MQTT 메시지 파싱 실패', e); }
      });

      mqttClient.on('reconnect', function () { setStatus('connecting'); });
      mqttClient.on('offline',   function () { setStatus('connecting'); });
      mqttClient.on('error',     function (e) { console.warn('[JarvisSync] MQTT 오류', e); });

      return true;
    } catch (e) {
      console.warn('[JarvisSync] MQTT 초기화 오류 → 로컬 모드', e);
      mqttClient = null;
      return false;
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

      if (fbReady && startFirebase(cfg)) return;   // 1순위
      startMqttOrLocal();                           // 2순위(MQTT) → 3순위(local)
    }
  };

  global.JarvisSync = Sync;
})(window);
