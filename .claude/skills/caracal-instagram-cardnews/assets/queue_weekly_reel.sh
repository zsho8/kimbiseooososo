#!/usr/bin/env bash
# [옵션 B] 주간 릴스 클라우드 예약 — 한 방에:
#   1) '다음 수요일 19:00 KST' 자동 계산
#   2) publish_reels.sh로 GitHub push(공개 URL) + Buffer 예약(맥 off여도 Buffer가 발행)
#   3) reel-status.json 갱신 → 사전 체크 페이지에 최신 예약 반영
#
# 사용(기본값은 하이록스 T1 세트):
#   bash queue_weekly_reel.sh
# 다른 릴스로:
#   bash queue_weekly_reel.sh --reel <mp4> --thumb <png> --caption <txt> [--due "YYYY-MM-DDTHH:MM:SS+09:00"] [--title "..."]
set -euo pipefail
ROOT="/Users/zsho/클로드 워크샵"; cd "$ROOT"
REEL="marketing-agent/output/reels-T1.mp4"
THUMB="marketing-agent/output/cardnews-T1-reels/slide_01.png"
CAPTION="marketing-agent/output/caption-T1-reel.txt"
TITLE="하이록스 입문 가이드"
DUE=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --reel) REEL="$2"; shift 2;;
    --thumb) THUMB="$2"; shift 2;;
    --caption) CAPTION="$2"; shift 2;;
    --due) DUE="$2"; shift 2;;
    --title) TITLE="$2"; shift 2;;
    *) echo "알 수 없는 인자: $1"; exit 2;;
  esac
done

# 1) 다음 수요일 19:00 KST 계산(오늘이 수요일이고 19시 전이면 오늘). KST 오프셋 고정(+09:00).
if [[ -z "$DUE" ]]; then
  DUE="$(/usr/bin/python3 - <<'PY'
import datetime
now = datetime.datetime.now()
# 수요일=2 (월=0). 오늘이 수요일이고 19시 이전이면 오늘, 아니면 다음 수요일.
days = (2 - now.weekday()) % 7
target = (now + datetime.timedelta(days=days)).replace(hour=19, minute=0, second=0, microsecond=0)
if days == 0 and now.hour >= 19:
    target += datetime.timedelta(days=7)
print(target.strftime("%Y-%m-%dT%H:%M:%S+09:00"))
PY
)"
fi
echo "▶ 예약 대상 시각(KST): $DUE"
BUST="t1r$(/usr/bin/python3 -c 'import datetime;print(datetime.date.today().strftime("%Y%m%d"))')"

# 2) 클라우드 푸시 + Buffer 예약
bash "$ROOT/.claude/skills/caracal-instagram-cardnews/assets/publish_reels.sh" \
  --reel "$REEL" --thumb "$THUMB" --caption "$CAPTION" --due "$DUE" --bust "$BUST"

# 3) 사전 체크 페이지용 상태 파일 갱신 + 푸시
/usr/bin/python3 - "$DUE" "$TITLE" "$REEL" "$CAPTION" <<'PY'
import json, sys
due, title, reel, caption = sys.argv[1:5]
# ISO(+09:00) -> 사람이 읽는 KST 표기
date_part, time_part = due.split("T"); hhmm = time_part[:5]
human = f"{date_part}(KST) {hhmm}"
json.dump({"status":"scheduled","scheduled_at":due,"scheduled_human":human,
           "title":title,"reel":reel,"caption":caption},
          open("reel-status.json","w",encoding="utf-8"), ensure_ascii=False, indent=2)
print("reel-status.json 갱신:", human)
PY

GITHUB_TOKEN="$(grep -E '^GITHUB_TOKEN=' .env.local 2>/dev/null | cut -d= -f2- || true)"
git add reel-status.json >/dev/null 2>&1 || true
git commit -q -m "reels: 상태 갱신(예약 $DUE)" >/dev/null 2>&1 || echo "  (상태 변경 없음)"
if [[ -n "$GITHUB_TOKEN" ]]; then
  git push "https://${GITHUB_TOKEN}@github.com/zsho8/kimbiseooososo.git" HEAD:main >/dev/null 2>&1 && echo "  상태 페이지 갱신 push 완료" || echo "  [!] 상태 push 실패(무시 가능)"
fi
echo "완료 — 사전 체크: https://kimbiseooososo.vercel.app/caracal-reel-check.html"
