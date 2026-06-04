#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CARACAL 릴스(9:16) 생성기 v2 — 나레이션(한국어 음성) + BGM 자동 합성
- 입력: 1080x1920 슬라이드 PNG(--dir) + 카드 스펙(--spec, 나레이션 텍스트 추출)
- 슬라이드별 나레이션을 macOS `say`(Yuna, ko_KR)로 생성 → 길이에 맞춰 슬라이드 노출시간 결정
- 저작권 안전 BGM 베드(ffmpeg 사인 화음 + 트레몰로) 합성, 낮은 볼륨으로 깔기
- 나레이션(오프셋 배치) + BGM 믹스 → 영상에 입힘. 인스타 호환 mp4(H.264/AAC/+faststart)
사용: python3 reels_gen.py --spec spec.json --dir <9:16 png폴더> --out <mp4>
"""
import os, sys, glob, argparse, subprocess, re, json
import imageio_ffmpeg
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
try:
    import tts_neural
    NEURAL = tts_neural.provider()
except Exception:
    tts_neural, NEURAL = None, None

FF = imageio_ffmpeg.get_ffmpeg_exe()
W, H = 1080, 1920

def run(cmd, desc=""):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(f"[ffmpeg 실패] {desc}\n" + r.stderr[-1500:], file=sys.stderr); sys.exit(1)
    return r

def dur_of(path):
    r = subprocess.run([FF, "-i", path], capture_output=True, text=True)
    m = re.search(r"Duration: (\d+):(\d+):(\d+\.\d+)", r.stderr)
    if not m: return 0.0
    h, mi, s = m.groups(); return int(h)*3600 + int(mi)*60 + float(s)

def clean(t):
    return re.sub(r"\s+", " ", (t or "").replace("*", "").replace("\n", " ")).strip()

def narration_for(s):
    if s.get("narration"): return clean(s["narration"])
    lay = s.get("layout", "photo")
    if lay == "cover":
        return clean(" ".join([s.get("kicker",""), s.get("headline",""), s.get("subtitle","")]))
    if lay == "closing":
        return clean(s.get("subtitle","")) + " 카라칼."
    # 릴스는 짧고 펀치있게: 기본은 헤드라인만. 더 읽히려면 spec에 "narration" 지정.
    return clean(s.get("headline",""))

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--spec", required=True); ap.add_argument("--dir", required=True); ap.add_argument("--out", required=True)
    ap.add_argument("--voice", default="Yuna"); ap.add_argument("--rate", type=int, default=150)
    ap.add_argument("--xfade", type=float, default=0.5); ap.add_argument("--mindur", type=float, default=2.4)
    ap.add_argument("--pad", type=float, default=0.5); ap.add_argument("--fps", type=int, default=30)
    ap.add_argument("--speed", type=float, default=0.0, help="나레이션 속도배속(0=자동: 뉴럴 1.08)")
    ap.add_argument("--maxlen", type=float, default=88.0, help="릴스 최대 길이(초). 초과 시 자동 추가 가속")
    a = ap.parse_args()
    spec = json.load(open(a.spec, encoding="utf-8"))
    imgs = sorted(glob.glob(os.path.join(a.dir, "slide_*.png")))
    slides = spec["slides"]
    n = min(len(imgs), len(slides))
    imgs = imgs[:n]; slides = slides[:n]
    tmp = "/tmp/caracal_reels"; os.makedirs(tmp, exist_ok=True)
    T = a.xfade

    # 1) 나레이션 생성 + 길이 측정 (뉴럴 키 있으면 사람같은 음성, 없으면 macOS say 폴백)
    print(f"나레이션 엔진: {'뉴럴('+NEURAL+')' if NEURAL else 'macOS say('+a.voice+')'}")
    speed = a.speed or (1.08 if NEURAL else 1.0)
    narr, ndur = [], []
    for i, s in enumerate(slides):
        txt = narration_for(s) or " "
        af = None
        if NEURAL:
            try:
                af = tts_neural.synth(txt, f"{tmp}/n{i}.mp3")
            except Exception as e:
                print(f"  [경고] 뉴럴 TTS 실패(슬라이드 {i+1}) → say 폴백: {e}", file=sys.stderr); af = None
        if not af:
            af = f"{tmp}/n{i}.aiff"
            subprocess.run(["say", "-v", a.voice, "-r", str(a.rate), "-o", af, txt], check=False)
        narr.append(af); ndur.append(dur_of(af) if os.path.exists(af) else 0.0)
    # 90초 제한: 필요하면 배속을 더 높여 maxlen 안에 맞춤
    def total_at(sp):
        return sum(max(a.mindur, nd / sp + a.pad) for nd in ndur) - (n - 1) * T
    while total_at(speed) > a.maxlen and speed < 1.35:
        speed = round(speed + 0.02, 3)
    durs = [max(a.mindur, nd / speed + a.pad) for nd in ndur]
    total = sum(durs) - (n - 1) * T
    print(f"슬라이드 {n}개, 총 {total:.1f}초 (나레이션 배속 {speed:.2f}x)")

    # 2) 영상(무음) — xfade 체인
    vcmd = [FF, "-y"]
    for img, d in zip(imgs, durs): vcmd += ["-loop", "1", "-t", f"{d:.3f}", "-i", img]
    parts = [f"[{i}:v]scale={W}:{H}:force_original_aspect_ratio=decrease,pad={W}:{H}:(ow-iw)/2:(oh-ih)/2,"
             f"setsar=1,fps={a.fps},format=yuv420p[v{i}]" for i in range(n)]
    prev = "v0"; off = durs[0] - T
    for i in range(1, n):
        parts.append(f"[{prev}][v{i}]xfade=transition=fade:duration={T}:offset={off:.3f}[x{i}]")
        prev = f"x{i}"; off += durs[i] - T
    video = f"{tmp}/video.mp4"
    vcmd += ["-filter_complex", ";".join(parts), "-map", f"[{prev}]",
             "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-r", str(a.fps), video]
    run(vcmd, "video")

    # 3) BGM 베드 합성 (사인 화음 + 트레몰로, 저작권 안전)
    bgm = f"{tmp}/bgm.m4a"
    chord = [146.83, 220.0, 277.18, 329.63]  # D-A-C#-E 계열 따뜻한 화음
    bcmd = [FF, "-y"]
    for f0 in chord: bcmd += ["-f", "lavfi", "-t", f"{total:.3f}", "-i", f"sine=frequency={f0}"]
    bmix = "".join(f"[{i}]" for i in range(len(chord)))
    bfilt = (f"{bmix}amix=inputs={len(chord)}:normalize=0,tremolo=f=1.9:d=0.5,lowpass=f=2600,"
             f"volume=0.14,afade=t=in:d=1.2,afade=t=out:st={max(0,total-1.6):.2f}:d=1.6[a]")
    bcmd += ["-filter_complex", bfilt, "-map", "[a]", "-c:a", "aac", "-b:a", "128k", bgm]
    run(bcmd, "bgm")

    # 4) 나레이션 오프셋 배치 + BGM 믹스 → 오디오
    acmd = [FF, "-y"]
    for f in narr: acmd += ["-i", f]
    acmd += ["-i", bgm]
    # 가공: 뉴럴 음성은 이미 자연스러우니 가볍게, macOS say는 방송톤으로 강하게 보정
    sp = f"atempo={speed:.3f}," if abs(speed - 1.0) > 0.01 else ""
    if NEURAL:
        ANC = sp + "highpass=f=70,acompressor=threshold=-18dB:ratio=3:attack=10:release=200,volume=1.35"
    else:
        ANC = sp + ("highpass=f=90,equalizer=f=3000:t=q:w=1.2:g=3,equalizer=f=180:t=q:w=1:g=-2,"
               "acompressor=threshold=-18dB:ratio=4:attack=8:release=180,aecho=0.8:0.85:28:0.15,volume=1.7")
    ap_parts = []; off = 0.0
    for i in range(n):
        ms = int(max(0, off + 0.3) * 1000)
        ap_parts.append(f"[{i}:a]{ANC},adelay={ms}|{ms}[d{i}]")
        off += durs[i] - T
    dlabels = "".join(f"[d{i}]" for i in range(n))
    bidx = n
    ap_parts.append(f"{dlabels}amix=inputs={n}:normalize=0[nar]")
    ap_parts.append(f"[nar][{bidx}:a]amix=inputs=2:normalize=0,alimiter=limit=0.95[ao]")
    audio = f"{tmp}/audio.m4a"
    acmd += ["-filter_complex", ";".join(ap_parts), "-map", "[ao]", "-t", f"{total:.3f}",
             "-c:a", "aac", "-b:a", "160k", audio]
    run(acmd, "audio")

    # 5) 영상 + 오디오 mux
    run([FF, "-y", "-i", video, "-i", audio, "-c:v", "copy", "-c:a", "aac",
         "-shortest", "-movflags", "+faststart", a.out], "mux")
    print(f"[OK] 릴스(나레이션+BGM): {a.out}  ({os.path.getsize(a.out)//1024}KB, 약 {total:.1f}초)")

if __name__ == "__main__":
    main()
