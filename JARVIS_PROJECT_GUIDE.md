# JARVIS 프로젝트 완전 가이드

> 이 문서는 "김비서" 시스템을 "자비스" JARVIS 시스템으로 변환한 전체 과정을 기록합니다.
> 동일한 방식으로 다시 진행하거나 유사한 프로젝트를 만들 때 참고하세요.

---

## 📋 목차
1. [프로젝트 개요](#프로젝트-개요)
2. [1단계: 시스템 이름 변경](#1단계-시스템-이름-변경)
3. [2단계: 테마 변경 (다크 모드)](#2단계-테마-변경-다크-모드)
4. [3단계: 음성 시스템 구현](#3단계-음성-시스템-구현)
5. [4단계: 영국 영어 음성 적용](#4단계-영국-영어-음성-적용)
6. [5단계: GitHub 및 Vercel 배포](#5단계-github-및-vercel-배포)

---

## 프로젝트 개요

### 목표
- 기존 "김비서" 웹 대시보드를 "자비스(JARVIS)" 시스템으로 전환
- Iron Man 영화의 JARVIS 캐릭터처럼 정중하고 신사적인 톤 구현
- Web Speech API를 활용한 음성 안내 시스템 추가
- 영국 영어 음성으로 영화 캐릭터 재현

### 주요 기능
- 📊 업무 관리 대시보드
- 🔊 JARVIS 음성 시스템 (Web Speech API)
- 🎨 다크/라이트 모드 전환
- 🌐 GitHub + Vercel 자동 배포

### 프로젝트 구조
```
클로드 워크샵/
├── work/
│   ├── dashboard.html          (메인 대시보드)
│   ├── 업무목록.csv            (작업 데이터)
│   └── ...
├── reports/
│   ├── report.html             (보고서)
│   ├── meeting-result.html     (회의결과)
│   └── ...
├── misc/
│   ├── chart.html              (차트)
│   └── ...
├── .env.local                  (GitHub 토큰 - git 제외)
├── .gitignore                  (배포 제외 파일)
├── vercel.json                 (Vercel 설정)
├── index.html                  (루트 리다이렉트)
└── JARVIS_PROJECT_GUIDE.md     (이 파일)
```

---

## 1단계: 시스템 이름 변경

### 1.1 HTML 제목 변경

**파일:** `work/dashboard.html` (및 other HTML files)

```html
<!-- Before -->
<title>김비서 대시보드</title>

<!-- After -->
<title>자비스 대시보드</title>
```

**적용 파일:**
- `work/dashboard.html`
- `reports/report.html`
- `reports/meeting-result.html`
- `misc/chart.html`

### 1.2 페이지 헤더 변경

```html
<!-- Before -->
<h1>김비서 시스템</h1>

<!-- After -->
<h1>자비스 시스템</h1>
```

### 1.3 CSS 변수 업데이트 (필요시)
- 색상 팔레트: 자비스 테마에 맞는 시안(Cyan) 액센트 추가
- 폰트: 전문적이고 현대적인 폰트 유지

---

## 2단계: 테마 변경 (다크 모드)

### 2.1 기본 테마 설정을 다크로 변경

**파일:** HTML의 `<html>` 태그

```html
<!-- Before -->
<html lang="ko" data-theme="light">

<!-- After -->
<html lang="ko" data-theme="dark">
```

### 2.2 FOUC (Flash of Unstyled Content) 방지 스크립트 수정

```html
<!-- Before -->
<script>
  (function(){
    var t = localStorage.getItem('jarvis-theme') || 'light';
    document.documentElement.setAttribute('data-theme', t);
  })();
</script>

<!-- After -->
<script>
  (function(){
    var t = localStorage.getItem('jarvis-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', t);
  })();
</script>
```

**중요:** 'light'를 'dark'로 변경하는 것이 핵심입니다.

### 2.3 CSS 변수 (Dark Theme)

`:root` 선택자에 다크 모드 색상 정의:

```css
:root {
  --bg:            #0a1628;      /* 어두운 배경 */
  --text-1:        #f0f9ff;      /* 밝은 텍스트 */
  --accent:        #06b6d4;      /* 시안 액센트 */
  --card-bg:       rgba(15,23,42,0.75);
  --card-border:   rgba(6,182,212,0.25);
  /* ... 기타 색상 */
}

/* Light Theme (옵션) */
[data-theme="light"] {
  --bg:            #f8fafc;
  --text-1:        #0f172a;
  --accent:        #0891b2;
  /* ... 기타 색상 */
}
```

### 2.4 테마 토글 함수

```javascript
function toggleTheme() {
  var current = localStorage.getItem('jarvis-theme') || 'dark';
  var next = current === 'dark' ? 'light' : 'dark';
  localStorage.setItem('jarvis-theme', next);
  document.documentElement.setAttribute('data-theme', next);
  
  // 음성 안내 (선택사항)
  speak('Display mode changed to ' + next + ', Sir.', 'normal');
}
```

---

## 3단계: 음성 시스템 구현

### 3.1 음성 활성화 상태 관리

```javascript
function getVoiceEnabled() {
  return localStorage.getItem('jarvis-voice-enabled') !== 'false';
}

function applyVoice(enabled) {
  localStorage.setItem('jarvis-voice-enabled', enabled ? 'true' : 'false');
  document.getElementById('vi').textContent = enabled ? '🔊' : '🔇';
  document.getElementById('vl').textContent = enabled ? '음성 켜기' : '음성 끄기';
}
```

### 3.2 음성 토글 버튼 추가

**HTML:**
```html
<!-- 헤더에 추가 -->
<button class="theme-btn" onclick="toggleVoice()">
  <span id="vi">🔊</span><span id="vl">음성 켜기</span>
</button>
```

### 3.3 기본 speak() 함수 (대시보드)

```javascript
var jarvisSpeaking = false;
var jarvisQueuedMessage = null;
var jarvisQueuedPriority = 'low';

function speak(text, priority) {
  if(!getVoiceEnabled() || !('speechSynthesis' in window)) return;

  if(jarvisSpeaking) {
    if(priority === 'high') {
      jarvisQueuedMessage = text;
      jarvisQueuedPriority = priority;
      window.speechSynthesis.cancel();
    }
    return;
  }

  jarvisSpeaking = true;
  var utterance = new SpeechSynthesisUtterance(text);
  utterance.language = 'en-GB';        /* 영국 영어 */
  utterance.pitch = 0.85;              /* 낮은 톤 */
  utterance.rate = 0.75;               /* 느린 속도 */
  utterance.volume = 1.0;

  var voices = window.speechSynthesis.getVoices();
  var britishVoice = voices.find(function(v) { 
    return v.lang === 'en-GB' && (v.name.includes('Google') || v.name.includes('British'));
  });
  if(!britishVoice) britishVoice = voices.find(function(v) { return v.lang.includes('en-GB'); });
  if(!britishVoice) britishVoice = voices.find(function(v) { return v.lang.includes('en'); });
  if(britishVoice) utterance.voice = britishVoice;

  utterance.onend = function() {
    jarvisSpeaking = false;
    if(jarvisQueuedMessage) {
      var msg = jarvisQueuedMessage;
      var pri = jarvisQueuedPriority;
      jarvisQueuedMessage = null;
      speak(msg, pri);
    }
  };

  window.speechSynthesis.speak(utterance);
}
```

### 3.4 간단한 speak() 함수 (다른 페이지)

```javascript
var jarvisSpeaking = false;

function speak(text, priority) {
  if(!getVoiceEnabled() || !('speechSynthesis' in window)) return;
  if(jarvisSpeaking) return;
  
  jarvisSpeaking = true;
  var utterance = new SpeechSynthesisUtterance(text);
  utterance.language = 'en-GB';
  utterance.pitch = 0.85;
  utterance.rate = 0.75;
  utterance.volume = 1.0;
  
  var voices = window.speechSynthesis.getVoices();
  var britishVoice = voices.find(function(v) { 
    return v.lang === 'en-GB' || (v.lang.includes('en') && v.name.includes('Google'));
  });
  if(!britishVoice) britishVoice = voices.find(function(v) { return v.lang.includes('en'); });
  if(britishVoice) utterance.voice = britishVoice;
  
  utterance.onend = function() { jarvisSpeaking = false; };
  window.speechSynthesis.speak(utterance);
}
```

### 3.5 페이지 로드 초기화

```javascript
document.addEventListener('DOMContentLoaded', function() {
  // 초기 음성 상태 적용
  applyVoice(getVoiceEnabled());
  
  // 시스템 시작 인사 (500ms 지연)
  setTimeout(function() {
    speak('Good morning, Sir. JARVIS system online. Ready to assist.', 'high');
  }, 500);
  
  // 마감일 확인 (2초 후)
  setTimeout(function() {
    checkDeadlines();
  }, 2000);
  
  // 체크박스 리스너 설정
  setupCheckboxListeners();
});
```

### 3.6 체크박스 이벤트 리스너

```javascript
function setupCheckboxListeners() {
  for(var i = 1; i <= 10; i++) {
    var checkbox = document.getElementById('t' + i);
    if(checkbox) {
      checkbox.addEventListener('change', function() {
        var item = this.closest('.todo-item');
        if(item) {
          var name = item.querySelector('.todo-name').textContent.trim();
          if(this.checked) {
            speak('Sir, ' + name + ' has been marked complete.', 'normal');
          } else {
            speak('Sir, ' + name + ' is now pending.', 'normal');
          }
        }
      });
    }
  }
}
```

### 3.7 마감일 확인 함수

```javascript
function checkDeadlines() {
  var today = new Date();
  var items = document.querySelectorAll('.todo-item');
  
  items.forEach(function(item) {
    var dueText = item.querySelector('.todo-due');
    if(dueText) {
      var dueStr = dueText.textContent.trim();
      // 마감일 파싱 (예: ~03/15 형식)
      // 오늘과 내일 이후 3일 이내 마감 확인
      var taskName = item.querySelector('.todo-name').textContent.trim();
      
      // 마감 임박 조건 확인 후
      if(isDeadlineApproaching(dueStr, today)) {
        speak('Attention, Sir. ' + taskName + ' deadline is approaching.', 'high');
      }
    }
  });
}
```

---

## 4단계: 영국 영어 음성 적용

### 4.1 음성 파라미터 설정

| 파라미터 | 값 | 설명 |
|---------|-----|------|
| `language` | `en-GB` | 영국 영어 (Received Pronunciation) |
| `pitch` | `0.85` | 0.5~2.0 범위, 낮을수록 낮은 톤 |
| `rate` | `0.75` | 0.1~10 범위, 작을수록 느린 속도 |
| `volume` | `1.0` | 0~1 범위, 명확한 발음 |

### 4.2 음성 선택 우선순위

```javascript
// 1순위: Google UK English Male
// 2순위: 기타 en-GB 음성
// 3순위: 기타 en (American) 음성
// 4순위: 시스템 기본 음성

var voices = window.speechSynthesis.getVoices();

// 우선순위 1
var britishVoice = voices.find(v => 
  v.lang === 'en-GB' && v.name.includes('Google')
);

// 우선순위 2
if(!britishVoice) {
  britishVoice = voices.find(v => v.lang === 'en-GB');
}

// 우선순위 3
if(!britishVoice) {
  britishVoice = voices.find(v => v.lang.includes('en'));
}
```

### 4.3 음성 테스트 명령어

```bash
# JavaScript 콘솔에서 테스트
speak("Good morning, Sir. JARVIS at your service.", "high");
```

---

## 5단계: GitHub 및 Vercel 배포

### 5.1 환경 파일 설정

**파일: `.env.local`**
```
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
```

**파일: `.gitignore`**
```
# Environment variables
.env
.env.local
.env.*.local

# Token files
token.txt
*.token

# System files
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp
*.swo

# Node modules (if needed)
node_modules/
```

### 5.2 Git 초기화 및 설정

```bash
# 저장소 폴더로 이동
cd /Users/zsho/클로드\ 워크샵

# Git 초기화
git init

# 사용자 설정
git config user.name "Claude Workshop"
git config user.email "workshop@example.com"

# 파일 추가
git add -A

# 커밋
git commit -m "첫 배포"
```

### 5.3 GitHub 원격 저장소 연결

```bash
# 원격 저장소 추가
git remote add origin https://github.com/zsho8/kimbiseooososo.git

# GitHub 토큰으로 푸시
TOKEN=$(cat .env.local | grep GITHUB_TOKEN | cut -d'=' -f2 | tr -d ' ')
git push -u https://git:${TOKEN}@github.com/zsho8/kimbiseooososo.git main
```

**주의:** 
- `.env.local`은 GitHub에 올라가지 않아야 합니다 (.gitignore 설정됨)
- 토큰은 안전하게 보관하세요

### 5.4 Vercel 설정

**파일: `vercel.json`**
```json
{
  "name": "kimbiseooososo",
  "version": 2,
  "public": true,
  "buildCommand": "echo 'Static site - no build needed'",
  "outputDirectory": "./",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/$1"
    }
  ],
  "headers": [
    {
      "source": "/work/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=3600"
        }
      ]
    },
    {
      "source": "/reports/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=3600"
        }
      ]
    },
    {
      "source": "/misc/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=3600"
        }
      ]
    }
  ]
}
```

### 5.5 루트 리다이렉트 페이지

**파일: `index.html`**
```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>자비스 시스템으로 이동 중...</title>
  <script>
    window.location.href = './work/dashboard.html';
  </script>
</head>
<body>
  <p><a href="./work/dashboard.html">자비스 대시보드로 이동하세요</a></p>
</body>
</html>
```

### 5.6 Vercel 배포 프로세스

1. **GitHub 저장소 생성**
   - https://github.com/new
   - Repository name: `kimbiseooososo`
   - Public 선택

2. **GitHub 토큰 생성**
   - https://github.com/settings/tokens
   - "Generate new token"
   - 권한: `repo` (필수)
   - 토큰 복사해서 `.env.local`에 저장

3. **Vercel 연결**
   - https://vercel.com
   - "New Project"
   - GitHub 계정 연결
   - `kimbiseooososo` 저장소 선택
   - Deploy

4. **배포 확인**
   ```bash
   # GitHub에서 최신 커밋 확인
   git log --oneline | head -1
   
   # Vercel에서 배포 상태 확인
   # https://vercel.com/dashboard
   ```

---

## 📝 주요 명령어 모음

### Git 작업
```bash
# 상태 확인
git status

# 파일 추가
git add -A           # 모든 파일
git add 파일명        # 특정 파일

# 커밋
git commit -m "메시지"

# 푸시
TOKEN=$(cat .env.local | grep GITHUB_TOKEN | cut -d'=' -f2 | tr -d ' ')
git push https://git:${TOKEN}@github.com/zsho8/kimbiseooososo.git main

# 로그 확인
git log --oneline
```

### 로컬 테스트
```bash
# Python HTTP 서버 시작
python3 -m http.server 3456

# 브라우저에서 접속
# http://localhost:3456/work/dashboard.html
```

### 음성 시스템 테스트
```javascript
// JavaScript 콘솔에서 실행
getVoiceEnabled()                    // 음성 활성화 확인
speak("Test message", "high")        // 음성 테스트
applyVoice(true)                     // 음성 켜기
applyVoice(false)                    // 음성 끄기
```

---

## 🔐 보안 체크리스트

- [ ] `.env.local`이 `.gitignore`에 포함되어 있는가?
- [ ] `token.txt`가 `.gitignore`에 포함되어 있는가?
- [ ] GitHub 토큰이 `.env.local`에 안전하게 보관되어 있는가?
- [ ] 민감한 파일들이 GitHub에 올라가지 않았는가?
- [ ] Vercel 배포에서 `.env.local`이 제외되었는가?

```bash
# 확인 명령어
git check-ignore .env.local    # 결과: .gitignore
git check-ignore token.txt     # 결과: .gitignore
```

---

## 🚀 배포 후 확인 사항

### 1. 웹사이트 접속 확인
```bash
curl -s -I https://kimbiseooososo.vercel.app
# HTTP/2 200 확인
```

### 2. 모든 페이지 확인
- [ ] https://kimbiseooososo.vercel.app (루트)
- [ ] https://kimbiseooososo.vercel.app/work/dashboard.html
- [ ] https://kimbiseooososo.vercel.app/reports/report.html
- [ ] https://kimbiseooososo.vercel.app/reports/meeting-result.html
- [ ] https://kimbiseooososo.vercel.app/misc/chart.html

### 3. 음성 시스템 확인
- [ ] 페이지 로드 시 영국 영어 인사말 재생
- [ ] 🔊 버튼으로 음성 켜기/끄기 가능
- [ ] 체크박스 클릭 시 작업 완료 음성 안내
- [ ] 테마 변경 시 음성 안내

---

## 📚 참고 자료

### Web Speech API
- MDN 문서: https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API
- SpeechSynthesis: https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis
- SpeechSynthesisUtterance: https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesisUtterance

### GitHub & Vercel
- GitHub Personal Access Token: https://github.com/settings/tokens
- Vercel Documentation: https://vercel.com/docs
- Vercel Configuration: https://vercel.com/docs/build-output-api/v3/configuration

---

## ✅ 다음 프로젝트를 위한 체크리스트

동일한 방식으로 새 프로젝트를 시작할 때:

### 준비 단계
- [ ] 프로젝트 폴더 생성
- [ ] 필요한 HTML 파일 생성
- [ ] 임시 `.env.local` 파일 생성 (토큰 빈 칸)

### 개발 단계
- [ ] 테마 설정 (다크 모드로 기본값 설정)
- [ ] CSS 변수 정의 (색상 팔레트)
- [ ] 음성 시스템 구현 (speak() 함수)
- [ ] 음성 파라미터 설정 (언어, 음높이, 속도)
- [ ] 음성 토글 버튼 추가

### 배포 단계
- [ ] `.gitignore` 파일 생성
- [ ] `vercel.json` 파일 생성
- [ ] `index.html` 루트 리다이렉트 파일 생성
- [ ] GitHub 저장소 생성
- [ ] GitHub 토큰 생성 및 `.env.local`에 저장
- [ ] Git 초기화 및 커밋
- [ ] GitHub에 푸시
- [ ] Vercel 배포
- [ ] 배포 상태 확인

---

## 💡 트러블슈팅

### 음성이 재생되지 않는 경우
1. 브라우저 볼륨 확인
2. 🔊 버튼으로 음성이 활성화되어 있는지 확인
3. 브라우저 음성 권한 확인
4. JavaScript 콘솔에서 에러 확인

### Vercel 배포가 작동하지 않는 경우
1. GitHub에 모든 파일이 푸시되었는지 확인
2. `.env.local`과 `token.txt`가 `.gitignore`에 있는지 확인
3. Vercel 대시보드에서 빌드 로그 확인
4. `vercel.json` 설정이 올바른지 확인
5. 루트 `index.html`이 존재하는지 확인

### GitHub 푸시 실패
```bash
# 토큰 확인
cat .env.local

# 토큰으로 푸시 재시도
TOKEN=$(cat .env.local | grep GITHUB_TOKEN | cut -d'=' -f2 | tr -d ' ')
git push https://git:${TOKEN}@github.com/zsho8/kimbiseooososo.git main
```

---

**마지막 업데이트:** 2026년 5월 28일  
**프로젝트 상태:** ✅ 완료 및 배포됨  
**배포 URL:** https://kimbiseooososo.vercel.app
