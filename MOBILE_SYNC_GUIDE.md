# 📱 맥북 ↔ 핸드폰 동기화

자비스 대시보드의 할 일 체크를 **맥북에서 누르면 핸드폰에도 즉시 반영**되고, 반대도 됩니다.

## ✅ 지금 바로 작동합니다 (설정 불필요)

기본적으로 **ntfy.sh** 라는 무료 서비스로 자동 연결됩니다. **일반 웹 포트(443·HTTPS)만 사용**해서 회사·학교·통신사 등 제한적인 네트워크도 대부분 통과합니다. 가입도, 설정값 입력도 필요 없어요.
- 맥북·핸드폰에서 **같은 주소**(https://kimbiseooososo.vercel.app/work/dashboard.html)를 열면
- 헤더 배지가 **🟢 동기화됨** 으로 바뀌고, 한쪽에서 체크하면 다른 쪽에 자동 반영됩니다.
- (ntfy 가 막히면 공개 MQTT 브로커로, 그것도 막히면 이 기기 저장으로 자동 전환됩니다.)

> ⚠️ 단, 이건 **무료 공개 서비스**라 가끔 느리거나 메시지 캐시가 만료될 수 있는 "best-effort" 방식입니다.
> 끊겨도 각 기기에 로컬 저장되므로 데이터는 안 사라집니다.
> **항상 안정적인 연결**을 원하면 아래 Firebase 설정(5분, 한 번)을 권장합니다.

---

# 🔒 (선택) 더 안정적인 Firebase로 업그레이드 — 5분

무료 **Firebase Realtime Database**를 쓰면 더 빠르고 안정적입니다. 신용카드 불필요.
설정값을 채우면 자동으로 MQTT 대신 Firebase를 사용합니다.

> 💡 설정 전: 공개 브로커로 동기화 / 설정 후: Firebase로 동기화 (둘 다 "🟢 동기화됨")

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
