/* ──────────────────────────────────────────────────────────────
   자비스 핸드폰 동기화 설정 (Firebase Realtime Database)

   ▸ 아래 값을 채우면  → 맥북에서 체크한 게 핸드폰에 실시간 반영(양방향).
   ▸ 비워두면(여기에… 그대로) → 이 기기에만 저장됩니다. 그래도 정상 동작합니다.

   ⚠️ 여기 값들은 "웹 앱 공개 설정"이라 깃허브에 올라가도 안전합니다.
      (실제 보안은 Firebase 데이터베이스 규칙에서 처리합니다.)

   채우는 방법: 프로젝트 루트의 MOBILE_SYNC_GUIDE.md 5분 가이드를 보세요.
   ────────────────────────────────────────────────────────────── */
window.JARVIS_FIREBASE_CONFIG = {
  apiKey:      "여기에-API-키-붙여넣기",
  authDomain:  "여기에-프로젝트-아이디.firebaseapp.com",
  databaseURL: "https://여기에-프로젝트-아이디-default-rtdb.firebaseio.com",
  projectId:   "여기에-프로젝트-아이디",

  // 같은 boardId 를 쓰는 기기끼리 동기화됩니다.
  // 남이 못 맞히게 비밀번호처럼 길게 정하세요. (영문/숫자)
  boardId:     "caracal-board-2026"
};
