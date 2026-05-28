# 클로드 워크샵 — CLAUDE.md

## 프로젝트 개요
**주식회사 카라칼(CARACAL)** 마케팅 에이전트 팀.
슬로건: **WE SUPPORT ALL THE PLAYERS**

리서치·콘텐츠·디자인·검수 에이전트가 협력해 카드뉴스, PPT, 뉴스레터, 유튜브 썸네일을 자동 생성하고 Buffer API로 소셜 미디어에 예약 포스팅한다.

### 브랜드 핵심 메시지
- 물리치료사가 설계한 압박 테이핑 양말 — 테이프 없이 착용만으로 관절 보호
- 타깃: 스포츠 동호인(러닝·등산·축구 등) 25~45세 + B2B(스포츠팀·군경 단체)
- 강점 수치: 와디즈 1,055% / 네이버 4.9점 / 100회 세탁 92% 유지 / 연간 비용 85% 절감

---

## 폴더 구조
```
클로드 워크샵/
├── marketing-agent/
│   ├── context/           # 브랜드·비즈니스·디자인 맥락 문서 (MD)
│   │   ├── brand-guidelines.md      ← 카라칼 브랜드 가이드라인
│   │   ├── business-context.md      ← 비즈니스·타깃·경쟁 정보
│   │   └── design-style-guide.md    ← 카드뉴스·PPT·썸네일 디자인 규칙
│   ├── template/          # 산출물 형식 템플릿 (MD)
│   │   ├── card-news-template.md
│   │   ├── newsletter-template.md
│   │   ├── ppt-template.md
│   │   └── youtube-thumbnail-template.md
│   └── output/            # 생성된 산출물 저장
├── .claude/
│   └── agents/            # 서브 에이전트 정의 파일
│       ├── research-agent.md
│       ├── content-agent.md
│       ├── design-agent.md
│       └── review-agent.md
├── .env                   # API 키 (절대 커밋 금지)
└── CLAUDE.md              # 이 파일
```

---

## 에이전트 팀 구성

| 에이전트 | 역할 | 입력 | 출력 |
|---------|------|------|------|
| `research-agent` | 카라칼 비즈니스 맥락에 맞는 주제 리서치 | 주제 | `output/research-report.md` |
| `content-agent` | 카드뉴스·뉴스레터 원고 작성 | 리서치 보고서 | `output/card-news-copy.md`, `output/newsletter-draft.md` |
| `design-agent` | PPTX·썸네일 생성 | 카피 + 디자인 가이드 | `output/*.pptx`, `output/thumbnail-brief.md` |
| `review-agent` | 전체 산출물 검수 | `output/` 폴더 | `output/review-report.md` |

---

## 라우팅 룰 (팀워크 SOP)

### 전체 파이프라인 실행
"모든 에이전트 팀을 가동해서 [주제]로 콘텐츠 만들어줘"
→ 실행 순서:
1. **research-agent** — 리서치 보고서 생성
2. **content-agent** + **design-agent** — 병렬 실행 (리서치 완료 후)
3. **review-agent** — 모든 산출물 완료 후 검수

### 개별 작업
- 리서치만: `research-agent` 호출
- 콘텐츠만: `content-agent` 호출 (`output/research-report.md` 필요)
- 디자인만: `design-agent` 호출 (`output/card-news-copy.md` 필요)
- 검수만: `review-agent` 호출

### 소셜 자동 포스팅
"output 폴더의 [파일명]을 [날짜] [시간]에 [채널]에 예약 포스팅해줘"
→ `.env`의 `BUFFER_API_KEY` 활용

---

## 사용 스킬

| 스킬 | 용도 |
|------|------|
| `anthropic-skills:pptx` | 카드뉴스·PPT PPTX 파일 생성 |
| `anthropic-skills:pdf` | PDF 내보내기 |
| `anthropic-skills:docx` | 뉴스레터·보고서 DOCX 생성 |

---

## 예외 처리
- `.claude/`, `node_modules/`, `.env` 파일은 스캔·참조에서 제외
- API 키는 절대 산출물·보고서에 포함하지 않음
- 권한 질문 없이 실행: `--dangerously-skip-permissions` 플래그 사용

---

## 보안 주의
- `.env` 파일은 절대 공유·커밋 금지
- API 키 노출 시 즉시 재발급
