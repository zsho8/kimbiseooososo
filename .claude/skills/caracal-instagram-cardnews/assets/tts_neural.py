#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
뉴럴 TTS(사람같은 음성) — .env의 키를 자동 감지해 사용.
우선순위: ELEVENLABS_API_KEY > OPENAI_API_KEY. 둘 다 없으면 None(호출측에서 macOS say로 폴백).
- ElevenLabs: 가장 자연스러운 한국어(eleven_multilingual_v2)
- OpenAI: gpt-4o-mini-tts (간편, 자연스러움)
CLI 테스트: python3 tts_neural.py --text "안녕하세요" --out /tmp/t.mp3
"""
import os, sys, json, argparse, urllib.request, urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))

def load_env():
    for fn in (".env", ".env.local"):
        p = os.path.join(ROOT, fn)
        if not os.path.exists(p): continue
        with open(p, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line: continue
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())

load_env()

def provider():
    if os.environ.get("ELEVENLABS_API_KEY", "").strip(): return "elevenlabs"
    if os.environ.get("OPENAI_API_KEY", "").strip(): return "openai"
    return None

def _post(url, data, headers, timeout=60):
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()

def synth(text, out_path):
    """text를 음성 파일(out_path, mp3)로 저장. 성공 시 경로 반환, 실패 시 예외."""
    p = provider()
    if p == "elevenlabs":
        key = os.environ["ELEVENLABS_API_KEY"].strip()
        vid = os.environ.get("ELEVENLABS_VOICE_ID", "").strip() or "onwK4e9ZLuTAKqWW03F9"  # Daniel(차분한 남성)
        url = f"https://api.elevenlabs.io/v1/text-to-speech/{vid}?output_format=mp3_44100_128"
        body = json.dumps({
            "text": text,
            "model_id": "eleven_multilingual_v2",
            "voice_settings": {"stability": 0.45, "similarity_boost": 0.8, "style": 0.25, "use_speaker_boost": True},
        }).encode("utf-8")
        audio = _post(url, body, {"xi-api-key": key, "Content-Type": "application/json", "Accept": "audio/mpeg"})
    elif p == "openai":
        key = os.environ["OPENAI_API_KEY"].strip()
        voice = os.environ.get("TTS_VOICE", "onyx").strip() or "onyx"
        body = json.dumps({"model": "gpt-4o-mini-tts", "voice": voice, "input": text,
                           "response_format": "mp3"}).encode("utf-8")
        audio = _post("https://api.openai.com/v1/audio/speech", body,
                      {"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
    else:
        raise RuntimeError("뉴럴 TTS 키 없음(.env에 ELEVENLABS_API_KEY 또는 OPENAI_API_KEY)")
    with open(out_path, "wb") as f:
        f.write(audio)
    return out_path

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--text", required=True); ap.add_argument("--out", required=True)
    a = ap.parse_args()
    pv = provider()
    if not pv:
        print("[!] 뉴럴 TTS 키 미설정 (.env)", file=sys.stderr); sys.exit(2)
    try:
        synth(a.text, a.out)
        print(f"[OK] {pv}로 생성: {a.out} ({os.path.getsize(a.out)} bytes)")
    except urllib.error.HTTPError as e:
        print(f"[HTTP {e.code}] {e.read().decode('utf-8','ignore')[:500]}", file=sys.stderr); sys.exit(1)

if __name__ == "__main__":
    main()
