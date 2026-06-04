#!/usr/bin/env bash
# 릴스 자동 게시: mp4(+썸네일)를 GitHub(=Vercel)로 push해 공개 URL 생성 → Buffer 인스타 릴스 예약
# 사용:
#   bash publish_reels.sh --reel marketing-agent/output/reels-T1.mp4 \
#        --thumb marketing-agent/output/cardnews-T1-reels/slide_01.png \
#        --caption marketing-agent/output/caption-T1.txt [--due "2026-06-10T19:30:00+09:00"] [--bust t1r1]
set -euo pipefail
ROOT="/Users/zsho/클로드 워크샵"; cd "$ROOT"
REEL=""; THUMB=""; CAPTION=""; DUE=""; BUST=""; CHANNEL=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --reel) REEL="$2"; shift 2;;
    --thumb) THUMB="$2"; shift 2;;
    --caption) CAPTION="$2"; shift 2;;
    --due) DUE="$2"; shift 2;;
    --bust) BUST="$2"; shift 2;;
    --channel) CHANNEL="$2"; shift 2;;
    *) echo "알 수 없는 인자: $1"; exit 2;;
  esac
done
[[ -z "$REEL" || -z "$CAPTION" ]] && { echo "사용법: --reel <mp4> --caption <txt> [--thumb png] [--due ISO] [--bust tok]"; exit 2; }
[[ ! -f "$REEL" ]] && { echo "[!] 영상 없음: $REEL"; exit 1; }

set -a; [[ -f .env ]] && source .env; set +a
GITHUB_TOKEN="$(grep -E '^GITHUB_TOKEN=' .env.local 2>/dev/null | cut -d= -f2- || true)"
PUBLIC_BASE_URL="${PUBLIC_BASE_URL:-https://kimbiseooososo.vercel.app}"
if [[ -z "${BUFFER_API_KEY:-}" ]]; then
  echo "[중단] BUFFER_API_KEY 미설정 → 릴스 자동 게시 불가(검수 후 수동 업로드)."; exit 3
fi

echo "▶ 1/3 영상 GitHub push (공개 URL 생성)"
git add "$REEL" ${THUMB:+"$THUMB"} 2>/dev/null || true
git commit -m "reels: publish $(basename "$REEL")" >/dev/null 2>&1 || echo "  (변경 없음)"
if [[ -n "$GITHUB_TOKEN" ]]; then
  git push "https://${GITHUB_TOKEN}@github.com/zsho8/kimbiseooososo.git" HEAD:main >/dev/null 2>&1 && echo "  push 완료" || { echo "  [!] push 실패"; exit 1; }
else
  git push origin HEAD:main >/dev/null 2>&1 || { echo "  [!] push 실패(토큰 없음)"; exit 1; }
fi

relurl() { local rel="${1#$ROOT/}"; local u="${PUBLIC_BASE_URL}/${rel}"; [[ -n "$BUST" ]] && u="${u}?v=${BUST}"; echo "$u"; }
VURL="$(relurl "$REEL")"; TURL=""; [[ -n "$THUMB" ]] && TURL="$(relurl "$THUMB")"
echo "  영상 URL: $VURL"

echo "▶ 2/3 Vercel 배포 대기(최대 180초; 영상은 더 걸릴 수 있음)"
for i in $(seq 1 36); do
  code="$(curl -s -o /dev/null -w '%{http_code}' "$VURL" || true)"
  [[ "$code" == "200" ]] && { echo "  배포 확인(200)"; sleep 3; break; }
  sleep 5; [[ $i -eq 36 ]] && echo "  [경고] 아직 200 아님(code=$code) — 그래도 시도"
done

echo "▶ 3/3 Buffer 인스타 릴스 예약"
ARGS=(publish --type reel --video "$VURL" --caption-file "$CAPTION")
[[ -n "$TURL" ]] && ARGS+=(--thumb "$TURL")
[[ -n "$DUE" ]] && ARGS+=(--due "$DUE")
[[ -n "$CHANNEL" ]] && ARGS+=(--channel "$CHANNEL")
python3 ".claude/skills/caracal-instagram-cardnews/assets/buffer_post.py" "${ARGS[@]}"
echo "완료."
