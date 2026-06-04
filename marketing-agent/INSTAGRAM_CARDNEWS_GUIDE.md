# 카라칼 인스타 카드뉴스 자동화 — 설정 & 사용 가이드

작성: 2026-06-02 / 대상 채널: @caracal_supply (정보성 카드뉴스 주 2회)

---

## 1. 한눈에 보는 구조

```
주제 뱅크(topic-bank.md)  ──①주제 1개 선택
        │
        ▼
[caracal-instagram-cardnews 스킬]  ──②리서치 ③카피 ④스펙JSON
        │
        ▼
cardnews_gen.py (Pillow)  ──⑤PNG 7장(1080×1350) 생성
        │
        ▼
자가 검수 ⑥  ──▶  output 폴더 저장 + 캡션  ──▶  ⑦사용자 승인 후 인스타 업로드
        ▲
        └── 주 2회(월·목 19:07) 스케줄러가 위 전체를 자동 실행
```

- **출력 형식:** 인스타에 바로 올릴 수 있는 **PNG 1080×1350**(세로형 — 저장율 높은 규격)
- **발행 방식:** 현재 **검수 후 수동 승인**(공식 계정 안전). **Buffer 자동 게시 파이프라인은 이미 구축 완료** — `.env`에 본인 Buffer API 키만 넣으면 자동 게시로 즉시 전환(§5).
- **잠정 포인트 컬러:** `#C8962A`(앰버 골드). BI 확정색 나오면 스펙 JSON `accent`만 교체.

---

## 2. 내가 만들어 둔 것

| 구성 | 경로 | 설명 |
|------|------|------|
| 자체 스킬 | `.claude/skills/caracal-instagram-cardnews/SKILL.md` | 카드뉴스 제작 전 과정 SOP |
| 생성 엔진 | `.claude/skills/.../assets/cardnews_gen.py` | 스펙 JSON → PNG 7장 (Pillow) |
| 주제 뱅크 | `marketing-agent/output/topic-bank.md` | 12개 주제 순환 큐 |
| 리서치 보고서 | `marketing-agent/output/research-report.md` | 근거·출처 정리 |
| 예시 카피 | `marketing-agent/output/card-news-copy.md` | 주제 01 카피·캡션 |
| 예시 카드뉴스 | `marketing-agent/output/cardnews-01/slide_01~07.png` | **바로 게시 가능한 첫 세트** |
| 스케줄러 | `~/.claude/scheduled-tasks/caracal-instagram-cardnews-biweekly/` | 월·목 19:07 자동 실행 |
| Buffer 자동게시 | `.claude/skills/.../assets/{publish_cardnews.sh, buffer_post.py}` | PNG→공개URL→인스타 예약(키만 넣으면 작동, §5) |
| 환경변수 | `.env` (gitignore) | `BUFFER_API_KEY` 등 — 커밋 금지 |

---

## 3. 자동 발행 동작 방식 (주 2회)

- **스케줄:** 매주 **월요일·목요일 오후 7시 7분**(cron `7 19 * * 1,4`, 약 6분 지터 → 실제 ~19:13)
- 매 실행마다: 주제 뱅크에서 다음 주제를 꺼내 → 리서치 → 카피 → PNG 7장 생성 → 자가 검수 → `output/`에 저장.
- 끝나면 **선택 주제 / PNG 폴더 경로 / 인스타 캡션 전문 / 검수 결과**를 한국어로 보고하고 **승인을 요청**(자동 게시 안 함).
- 주제가 3개 미만으로 줄면 자동으로 웹 리서치해 새 주제 5개를 보충.

> ⚠️ 중요: 스케줄 작업은 **이 앱(Claude)이 켜져 있을 때** 실행됩니다. 발행 시간에 앱이 꺼져 있으면 **다음 실행 때** 돌아갑니다. 월·목 저녁 앱을 켜두시는 걸 권장.
> ℹ️ 사이드바 "Scheduled"에 표시되는 요약 문구가 "Monday만"으로 보일 수 있으나, 실제 cron은 **월·목 모두** 포함입니다.

---

## 4. 사용법

### A. 자동에 맡기기 (기본)
아무것도 안 해도 월·목 저녁에 카드뉴스 1세트가 만들어지고 승인 요청이 옵니다.
승인하면 → `output/cardnews-<번호>/` 의 PNG 7장을 인스타에 캐러셀로 올리고, 보고된 캡션을 붙여넣으면 끝.

### B. 지금 바로 1세트 더 만들기 (수동)
채팅에 이렇게 입력:
```
카라칼 카드뉴스 만들어줘   (또는 특정 주제 지정: "등산 하산 무릎 주제로 카드뉴스 만들어줘")
```
→ 스킬이 자동 실행됩니다.

### C. 사이드바에서 즉시 실행
사이드바 **Scheduled → caracal-instagram-cardnews-biweekly → Run now** 클릭.

### D. 직접 생성기만 돌리기 (스펙 JSON이 있을 때)
```bash
cd "/Users/zsho/클로드 워크샵"
python3 ".claude/skills/caracal-instagram-cardnews/assets/cardnews_gen.py" \
  --spec "marketing-agent/output/cardnews-spec-01.json" \
  --out  "marketing-agent/output/cardnews-01"
```

---

## 5. 완전 자동 게시 (Buffer 연동 — 이미 구축 완료, 키만 넣으면 작동)

PNG·캡션을 인스타에 **자동 예약 게시**하는 파이프라인을 전부 만들어 뒀습니다. 코드/스크립트는 완성·검증
끝났고, **딱 하나 — 본인의 Buffer 개인 API 키** 만 넣으면 바로 켜집니다.

### 구축해 둔 것
| 구성 | 경로 | 역할 |
|------|------|------|
| 오케스트레이터 | `.claude/skills/.../assets/publish_cardnews.sh` | PNG push → 공개 URL → Buffer 예약, 한 줄 실행 |
| Buffer 클라이언트 | `.claude/skills/.../assets/buffer_post.py` | GraphQL `verify`/`introspect`/`publish` |
| 환경변수 | `.env` (gitignore됨) | `BUFFER_API_KEY` 등 — **절대 커밋·공유 금지** |

### 동작 원리 (Buffer는 '이미지 URL'만 받음 → 그 제약을 우회)
1. PNG 7장을 GitHub `main`에 push → 이 폴더가 곧 `kimbiseooososo.vercel.app` 저장소라 **공개 URL** 이 생김
2. Vercel 배포 200 확인까지 폴링
3. Buffer GraphQL `createPost`로 인스타 캐러셀 **예약 게시**

### 본인이 해야 할 것 (5분, 나는 키를 대신 만들 수 없음)
1. **Buffer 가입** → publish.buffer.com
2. **인스타 비즈니스 계정 연결**: Buffer에서 @caracal_supply(Instagram Business/Creator) 채널 추가
   - (인스타가 '비즈니스/크리에이터' 계정이고 페이스북 페이지와 연결돼 있어야 Buffer가 게시 가능)
3. **개인 API 키 발급**: https://publish.buffer.com/settings/api → 키 복사
4. `.env` 파일 열어 `BUFFER_API_KEY=` 뒤에 붙여넣기 (커밋 금지, 이미 .gitignore 처리됨)

### 키 넣은 직후 — 나한테 "buffer 연결 확인해줘" 라고만 하면
```bash
python3 ".claude/skills/caracal-instagram-cardnews/assets/buffer_post.py" verify
```
→ 연결된 조직·채널 목록과 **인스타 채널 ID** 를 찾아 `.env`의 `BUFFER_CHANNEL_ID`에 기록.
필요 시 `introspect`로 실제 입력 스키마를 확인해 mutation을 1~2줄 맞춥니다.

### 실제 자동 게시 (스케줄러가 자동 호출 / 수동도 가능)
```bash
bash ".claude/skills/caracal-instagram-cardnews/assets/publish_cardnews.sh" \
  --dir "marketing-agent/output/cardnews-T2" \
  --caption "marketing-agent/output/caption-T2.txt" \
  --due "2026-06-04T19:30:00+09:00"   # 생략 시 Buffer 큐에 추가
```
> 안전장치: `.env`에 키가 없으면 스크립트가 **exit 3**으로 멈추고 자동으로 **검수 후 수동 승인** 모드로 폴백합니다.
> 공식 계정 리스크 때문에 운영 초기에는 `--due`로 **30분 뒤 예약** → Buffer 대시보드에서 최종 확인 후 나가는 방식을 권장합니다.

---

## 6. 커스터마이즈 포인트

| 바꾸고 싶은 것 | 방법 |
|---------------|------|
| 발행 요일·시간 | "스케줄 화·금 오전 8시로 바꿔줘" |
| 포인트 컬러 | 스펙 JSON `accent` 값 교체 (예: `#E8500A`) |
| 슬라이드 수·구성 | 스펙 JSON `slides` 배열 편집 (레이아웃: cover/text/step/stat/summary/cta) |
| 주제 추가·우선순위 | `topic-bank.md` 큐 직접 편집 |
| 실제 인스타 인사이트 반영 | @caracal_supply Insights의 "저장·공유 상위 게시물" 주제를 topic-bank 상단에 넣으면 그 결을 따라감 |

---

## 7. 솔직한 한계 (알아두세요)

- **"최근 한 달 인스타 저장·공유 1위" 데이터**는 @caracal_supply 계정의 비공개 Insights라 직접 못 읽습니다. 대신 **공개 트렌드 리서치(2026 알고리즘: 저장·공유가 도달 핵심 / 부상예방·튜토리얼이 저장률 최상)** 를 근거로 주제를 잡았고, 실제 Insights 상위 주제를 알려주시면 topic-bank에 반영해 정확도를 높일 수 있습니다.
- 폰트는 시스템 기본 **Apple SD Gothic Neo**(브랜드 지정 Noto Sans KR/Montserrat 미설치 대체). 필요 시 설치 후 엔진 폰트 경로 교체 가능.
