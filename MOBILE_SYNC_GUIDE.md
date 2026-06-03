# 📱 맥북 ↔ 핸드폰 동기화 설정 가이드 (5분)

자비스 대시보드의 할 일 체크를 **맥북에서 누르면 핸드폰에도 즉시 반영**되고, 반대도 되도록 만드는 설정입니다.
무료 서비스 **Firebase Realtime Database**를 사용합니다. 신용카드 필요 없습니다.

> 💡 **설정을 안 해도 대시보드는 그대로 작동합니다.**
> 설정 전에는 "💾 이 기기 저장"(각 기기에만 저장), 설정 후에는 "🟢 동기화됨"(기기 간 실시간 연동)으로 바뀝니다.

---

## 1단계 — Firebase 프로젝트 만들기

1. https://console.firebase.google.com 접속 → 구글 계정 로그인
2. **프로젝트 추가** 클릭 → 이름 아무거나 (예: `caracal-jarvis`) → 계속
3. "Google 애널리틱스"는 **사용 안 함**으로 두고 → **프로젝트 만들기**

## 2단계 — Realtime Database 켜기

1. 왼쪽 메뉴 **빌드(Build) → Realtime Database** 클릭
2. **데이터베이스 만들기** 클릭
3. 위치는 기본값(미국) 그대로 → **다음**
4. 보안 규칙은 일단 **잠금 모드**로 시작 → **사용 설정** (규칙은 4단계에서 바꿉니다)

## 3단계 — 웹 앱 설정값 복사하기

1. 왼쪽 위 **⚙️(설정) → 프로젝트 설정** 클릭
2. 아래로 내려 **내 앱** 영역에서 **웹 아이콘 `</>`** 클릭
3. 앱 닉네임 아무거나 입력 → **앱 등록** (호스팅은 체크 안 해도 됨)
4. 화면에 나오는 `firebaseConfig` 값이 보입니다. 아래처럼 생겼어요:

   ```js
   const firebaseConfig = {
     apiKey: "AIzaSyXXXXXXXXXXXXXXXXXX",
     authDomain: "caracal-jarvis.firebaseapp.com",
     databaseURL: "https://caracal-jarvis-default-rtdb.firebaseio.com",
     projectId: "caracal-jarvis",
     ...
   };
   ```

5. 이 값들을 프로젝트의 **`js/firebase-config.js`** 파일에 옮겨 적습니다.
   `여기에-…` 부분을 본인 값으로 바꾸기만 하면 됩니다:

   ```js
   window.JARVIS_FIREBASE_CONFIG = {
     apiKey:      "AIzaSyXXXXXXXXXXXXXXXXXX",
     authDomain:  "caracal-jarvis.firebaseapp.com",
     databaseURL: "https://caracal-jarvis-default-rtdb.firebaseio.com",
     projectId:   "caracal-jarvis",
     boardId:     "caracal-board-2026"   // 그대로 둬도 되고, 길게 바꿔도 됩니다
   };
   ```

   > `databaseURL`이 빠지면 동기화가 안 됩니다. 꼭 들어갔는지 확인하세요.

## 4단계 — 데이터베이스 규칙 설정 (중요)

**Realtime Database → 규칙(Rules)** 탭에서 아래로 바꾸고 **게시**하세요.
`boardId`를 아는 기기만 읽고 쓰게 되어, 사실상 우리끼리만 쓰는 비밀번호 역할을 합니다.

```json
{
  "rules": {
    "jarvis": {
      "$board": {
        ".read": true,
        ".write": true
      }
    }
  }
}
```

> 이 규칙은 "boardId를 아는 사람만 접근"하는 간단한 방식입니다.
> 그래서 `boardId`는 **남이 못 맞히게 길게** 정하는 걸 권장합니다 (예: `caracal-7f3k9-2026`).
> 더 엄격한 로그인 기반 보안이 필요하면 알려주세요. (익명 인증 적용 가능)

## 5단계 — 배포하고 핸드폰에서 열기

1. 바뀐 파일을 깃허브에 올리면 Vercel이 자동 배포합니다 (보통 1분 이내).
2. 핸드폰 브라우저에서 접속:
   **https://kimbiseooososo.vercel.app/work/dashboard.html**
3. 헤더 배지가 **🟢 동기화됨** 으로 바뀌면 성공입니다.
4. 맥북에서 할 일 하나 체크 → 핸드폰 화면이 잠깐 깜빡이며 자동으로 체크됩니다. ✅

---

## 📲 핸드폰 홈 화면에 앱처럼 추가하기

- **아이폰(사파리):** 공유 버튼 `􀈂` → **홈 화면에 추가**
- **안드로이드(크롬):** 우측 메뉴 ⋮ → **홈 화면에 추가**

이러면 주소창 없이 앱처럼 전체화면으로 열립니다.

---

## ❓ 문제 해결

| 증상 | 확인할 것 |
|------|-----------|
| 계속 "💾 이 기기 저장" | `js/firebase-config.js`에 `여기에-…` 글자가 남아있는지, `databaseURL`이 채워졌는지 확인 |
| "🟡 연결 중…"에서 안 바뀜 | 4단계 규칙을 **게시**했는지, `databaseURL` 주소가 정확한지 확인 |
| 맥북·핸드폰이 따로 논다 | 두 기기의 `boardId`가 **똑같은지** 확인 (같은 사이트면 자동으로 같습니다) |
| 동기화 끄고 싶다 | `firebase-config.js`의 값을 다시 `여기에-…`로 되돌리면 로컬 저장으로 돌아갑니다 |
