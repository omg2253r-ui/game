#!/usr/bin/env python3
"""พากย์คลิปด้วยเสียงของเจ้าของ (voice clone) — F5-TTS-THAI + faster-whisper + ffmpeg.

Subcommands:
  prepare-voice SRC          ทำเสียงต้นแบบจากคลิป/ไฟล์เสียงของคุณ -> voice/ref.wav + voice/ref.txt
  speak TEXT -o OUT.wav      อ่านข้อความด้วยเสียงคุณ
  transcribe CLIP -o SEG.json ถอดเสียงคลิปเป็นช่วงเวลา (start/end/text) เพื่อให้แก้บทพากย์
  dub CLIP SEG.json -o OUT.mp4 สร้างเสียงพากย์ตามบท แล้ววางให้ตรงเวลา ผสมกับเสียงเดิม (ลดเสียง) และรวมกลับเข้าวิดีโอ
"""
import argparse, json, os, subprocess, sys, tempfile
from pathlib import Path

SKILL_DIR = Path(__file__).resolve().parent.parent
VOICE_DIR = Path(os.environ.get("MY_VOICE_DIR", SKILL_DIR / "voice"))
SR = 24000


def run(cmd):
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)


def duration(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                          "-of", "csv=p=0", str(path)], capture_output=True, text=True, check=True)
    return float(out.stdout.strip())


def to_wav(src, dst, sr=SR, extra=()):
    run(["ffmpeg", "-y", "-i", str(src), "-vn", "-ac", "1", "-ar", str(sr), *extra, str(dst)])


_whisper = None
def whisper(model):
    global _whisper
    if _whisper is None:
        from faster_whisper import WhisperModel
        _whisper = WhisperModel(model, device="auto", compute_type="int8")
    return _whisper


def transcribe_file(path, model, lang):
    import numpy as np  # decode ด้วย ffmpeg เอง (เลี่ยงปัญหาเวอร์ชัน PyAV)
    pcm = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-ac", "1", "-ar", "16000",
                          "-f", "s16le", "-"], capture_output=True, check=True).stdout
    audio = np.frombuffer(pcm, np.int16).astype(np.float32) / 32768.0
    segs, _ = whisper(model).transcribe(audio, language=lang or None, vad_filter=True,
                                        beam_size=5)
    return [{"start": round(s.start, 2), "end": round(s.end, 2), "text": s.text.strip()} for s in segs]


_tts = None
def tts():
    global _tts
    if _tts is None:
        from f5_tts_th.tts import TTS
        _tts = TTS(model=os.environ.get("F5_TH_MODEL", "v1"))
    return _tts


def load_ref():
    wav, txt = VOICE_DIR / "ref.wav", VOICE_DIR / "ref.txt"
    if not wav.exists() or not txt.exists():
        sys.exit(f"ยังไม่มีเสียงต้นแบบที่ {VOICE_DIR} — รัน prepare-voice ก่อน")
    return str(wav), txt.read_text(encoding="utf-8").strip()


def synth(text, out, speed=1.0, step=32, cfg=2.0):
    import soundfile as sf
    ref_wav, ref_txt = load_ref()
    wav = tts().infer(ref_audio=ref_wav, ref_text=ref_txt, gen_text=text,
                      step=step, cfg=cfg, speed=speed)
    sf.write(str(out), wav, SR)


def atempo_chain(f):
    parts = []
    while f > 2.0:
        parts.append("atempo=2.0"); f /= 2.0
    while f < 0.5:
        parts.append("atempo=0.5"); f /= 0.5
    parts.append(f"atempo={f:.4f}")
    return ",".join(parts)


def cmd_prepare(a):
    VOICE_DIR.mkdir(parents=True, exist_ok=True)
    full = VOICE_DIR / "_full.wav"
    # ตัดความเงียบหัวท้าย + normalize ความดัง
    to_wav(a.src, full, extra=["-af", "silenceremove=start_periods=1:start_threshold=-40dB,"
                               "areverse,silenceremove=start_periods=1:start_threshold=-40dB,areverse,"
                               "loudnorm=I=-18:TP=-2"])
    d = duration(full)
    cut = min(d, a.max_seconds)
    run(["ffmpeg", "-y", "-i", str(full), "-t", f"{cut:.2f}", str(VOICE_DIR / "ref.wav")])
    full.unlink()
    text = a.text or " ".join(s["text"] for s in transcribe_file(VOICE_DIR / "ref.wav", a.whisper, a.lang))
    (VOICE_DIR / "ref.txt").write_text(text + "\n", encoding="utf-8")
    print(json.dumps({"ref_wav": str(VOICE_DIR / "ref.wav"), "seconds": round(cut, 2),
                      "ref_text": text}, ensure_ascii=False, indent=2))
    if cut < 3:
        print("คำเตือน: เสียงต้นแบบสั้นกว่า 3 วินาที คุณภาพอาจไม่ดี", file=sys.stderr)


def cmd_speak(a):
    synth(a.text, a.out, speed=a.speed)
    print(a.out)


def cmd_transcribe(a):
    with tempfile.TemporaryDirectory() as td:
        w = Path(td) / "a.wav"; to_wav(a.clip, w, sr=16000)
        segs = transcribe_file(w, a.whisper, a.lang)
    for s in segs:
        s["orig"] = s["text"]  # text = บทที่จะพากย์ (แก้/แปลได้), orig = ของเดิม
    Path(a.out).write_text(json.dumps(segs, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(segs, ensure_ascii=False, indent=2))


def cmd_dub(a):
    segs = json.loads(Path(a.segments).read_text(encoding="utf-8"))
    clip_len = duration(a.clip)
    has_video = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v", "-show_entries",
                                "stream=index", "-of", "csv=p=0", str(a.clip)],
                               capture_output=True, text=True).stdout.strip() != ""
    with tempfile.TemporaryDirectory() as td:
        td = Path(td)
        inputs, filters, labels = [], [], []
        for i, s in enumerate(segs):
            text = (s.get("text") or "").strip()
            if not text:
                continue
            raw, fit = td / f"r{i}.wav", td / f"f{i}.wav"
            synth(text, raw, speed=s.get("speed", a.speed))
            slot = max(0.3, float(s["end"]) - float(s["start"]))
            if i + 1 < len(segs):  # ใช้ช่องว่างถึงประโยคถัดไปได้
                slot = max(slot, float(segs[i + 1]["start"]) - float(s["start"]) - 0.05)
            d = duration(raw)
            f = d / slot if a.fit else 1.0
            f = min(max(f, 1.0), a.max_speedup)  # เร่งได้ ไม่ยืดให้ช้าลง
            run(["ffmpeg", "-y", "-i", str(raw), "-af", atempo_chain(f), str(fit)])
            print(f"[{s['start']:.2f}-{s['end']:.2f}] {d:.2f}s -> x{f:.2f}  {text}", file=sys.stderr)
            inputs += ["-i", str(fit)]
            n = len(labels) + 1
            ms = int(float(s["start"]) * 1000)
            filters.append(f"[{n}:a]adelay={ms}|{ms},volume={a.voice_gain}[v{n}]")
            labels.append(f"[v{n}]")
        if not labels:
            sys.exit("ไม่มีบทพากย์ใน segments")
        bg = f"[0:a]aresample={SR},pan=mono|c0=0.5*c0+0.5*c1,volume={a.bg}[bg]" if a.bg > 0 else None
        mix_in = ([" [bg]".strip()] if bg else []) + labels
        fc = ";".join(([bg] if bg else []) + filters +
                      [f"{''.join(mix_in)}amix=inputs={len(mix_in)}:normalize=0:duration=longest,"
                       f"alimiter=limit=0.95[out]"])
        dub_wav = td / "dub.wav"
        try:
            run(["ffmpeg", "-y", "-i", str(a.clip), *inputs, "-filter_complex", fc,
                 "-map", "[out]", "-t", f"{clip_len:.3f}", "-ar", "48000", str(dub_wav)])
        except subprocess.CalledProcessError:
            # คลิปที่เป็นสเตอริโอ/โมโนต่างกัน: ลอง pan แบบโมโน
            fc = fc.replace("pan=mono|c0=0.5*c0+0.5*c1", "pan=mono|c0=c0")
            run(["ffmpeg", "-y", "-i", str(a.clip), *inputs, "-filter_complex", fc,
                 "-map", "[out]", "-t", f"{clip_len:.3f}", "-ar", "48000", str(dub_wav)])
        out = Path(a.out)
        if has_video and out.suffix.lower() not in (".wav", ".mp3", ".m4a"):
            run(["ffmpeg", "-y", "-i", str(a.clip), "-i", str(dub_wav), "-map", "0:v", "-map", "1:a",
                 "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", str(out)])
        else:
            run(["ffmpeg", "-y", "-i", str(dub_wav), str(out)])
    print(out)


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--whisper", default=os.environ.get("WHISPER_MODEL", "medium"))
    p.add_argument("--lang", default="th", help="ภาษาที่พูดในคลิป (th, en, ... หรือ '' ให้เดา)")
    sub = p.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("prepare-voice"); s.add_argument("src")
    s.add_argument("--text", help="ข้อความที่พูดในเสียงต้นแบบ (ถ้าไม่ใส่จะถอดเสียงให้)")
    s.add_argument("--max-seconds", type=float, default=8.0)
    s.set_defaults(fn=cmd_prepare)

    s = sub.add_parser("speak"); s.add_argument("text"); s.add_argument("-o", "--out", required=True)
    s.add_argument("--speed", type=float, default=1.0); s.set_defaults(fn=cmd_speak)

    s = sub.add_parser("transcribe"); s.add_argument("clip"); s.add_argument("-o", "--out", required=True)
    s.set_defaults(fn=cmd_transcribe)

    s = sub.add_parser("dub"); s.add_argument("clip"); s.add_argument("segments")
    s.add_argument("-o", "--out", required=True)
    s.add_argument("--bg", type=float, default=0.15, help="ความดังเสียงเดิมที่เหลือ (0 = ตัดทิ้ง)")
    s.add_argument("--voice-gain", type=float, default=1.0)
    s.add_argument("--speed", type=float, default=1.0)
    s.add_argument("--max-speedup", type=float, default=1.35)
    s.add_argument("--no-fit", dest="fit", action="store_false")
    s.set_defaults(fn=cmd_dub)

    a = p.parse_args(); a.fn(a)


if __name__ == "__main__":
    main()
