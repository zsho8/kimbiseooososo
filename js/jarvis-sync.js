/* ──────────────────────────────────────────────────────────────
   자비스 기기 간 동기화 모듈  (맥북 ↔ 핸드폰)

   · Firebase Realtime Database 설정이 있으면  → 실시간 양방향 동기화
   · 설정이 없거나 연결 실패 시            → 이 기기 localStorage 에만 저장 (안전한 폴백)

   설정 방법은 MOBILE_SYNC_GUIDE.md 를 참고하세요.
   ────────────────────────────────────────────────────────────── */
(function (global) {
  'use strict';

  var LS_KEY = 'jarvis-tasks';   // 로컬 저장 키
  var listeners = [];            // 상태 변화 콜백 (state, fromRemote)
  var statusCb = null;           // 연결 상태 콜백 (status, mode)
  var mode = 'local';            // 'cloud' | 'local'
  var dbRef = null;
  var applyingRemote = false;    // 원격 반영 중에는 클라우드로 되쓰지 않음 (루프 방지)

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

  function hasRealConfig(cfg) {
    // 플레이스홀더('여기에…') 가 남아 있으면 미설정으로 간주
    if (!cfg || !cfg.apiKey || !cfg.databaseURL) return false;
    if (cfg.apiKey.indexOf('여기에') !== -1) return false;
    if (cfg.databaseURL.indexOf('여기에') !== -1) return false;
    return true;
  }

  var Sync = {
    mode: function () { return mode; },

    /** 상태 변화 구독: fn(state, fromRemote) */
    onUpdate: function (fn) { if (typeof fn === 'function') listeners.push(fn); },

    /** 연결 상태 구독: fn(status, mode)  status = connecting|synced|local */
    onStatus: function (fn) { statusCb = fn; },

    /** 체크 상태 1건 변경 저장 + (클라우드면) 전파 */
    set: function (id, checked) {
      var state = readLocal();
      state[id] = !!checked;
      writeLocal(state);
      if (mode === 'cloud' && dbRef && !applyingRemote) {
        dbRef.child(id).set(!!checked).catch(function (e) {
          console.warn('[JarvisSync] 클라우드 쓰기 실패 (로컬에는 저장됨)', e);
        });
      }
    },

    /** 현재 전체 상태 */
    getAll: function () { return readLocal(); },

    init: function () {
      var cfg = global.JARVIS_FIREBASE_CONFIG;
      var ready = hasRealConfig(cfg) &&
                  typeof global.firebase !== 'undefined' &&
                  typeof global.firebase.initializeApp === 'function';

      // 어떤 경우든 우선 로컬에 저장된 상태부터 화면에 반영
      notify(readLocal(), false);

      if (!ready) {
        mode = 'local';
        setStatus('local');
        return;
      }

      try {
        var app = (global.firebase.apps && global.firebase.apps.length)
          ? global.firebase.app()
          : global.firebase.initializeApp(cfg);
        var boardId = cfg.boardId || 'main-board';
        dbRef = global.firebase.database(app).ref('jarvis/' + boardId + '/tasks');
        mode = 'cloud';
        setStatus('connecting');

        dbRef.on('value', function (snap) {
          var remote = snap.val();

          // 클라우드에 아직 데이터가 없으면, 이 기기의 현재 상태로 초기 세팅(시드)
          if (remote == null) {
            var local = readLocal();
            var keys = Object.keys(local);
            if (keys.length) {
              applyingRemote = true;
              keys.forEach(function (k) { dbRef.child(k).set(!!local[k]); });
              applyingRemote = false;
            }
            setStatus('synced');
            return;
          }

          applyingRemote = true;
          writeLocal(remote);
          notify(remote, true);
          applyingRemote = false;
          setStatus('synced');
        }, function (err) {
          console.warn('[JarvisSync] 클라우드 연결 실패 → 로컬 모드로 전환', err);
          mode = 'local';
          dbRef = null;
          setStatus('local');
        });
      } catch (e) {
        console.warn('[JarvisSync] 초기화 오류 → 로컬 모드', e);
        mode = 'local';
        dbRef = null;
        setStatus('local');
      }
    }
  };

  global.JarvisSync = Sync;
})(window);
