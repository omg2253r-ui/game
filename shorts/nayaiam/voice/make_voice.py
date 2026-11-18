"""Thai narration with the offline MMS-TTS Thai model (sherpa-onnx).
Usage: python make_voice.py <model_dir> [speed]
Writes voice.wav (48 kHz mono) and lines_timed.json (start/end per line, seconds)."""
import sys, json, unicodedata, numpy as np, scipy.io.wavfile as w
from scipy.signal import resample_poly
import sherpa_onnx
md = sys.argv[1].rstrip('/') + '/'; speed = float(sys.argv[2]) if len(sys.argv) > 2 else 1.0
toks = {l.split(' ')[0] for l in open(md + 'tokens.txt', encoding='utf8').read().split('\n') if l}
toks.add(' ')
tts = sherpa_onnx.OfflineTts(sherpa_onnx.OfflineTtsConfig(model=sherpa_onnx.OfflineTtsModelConfig(
    vits=sherpa_onnx.OfflineTtsVitsModelConfig(model=md + 'model.onnx', tokens=md + 'tokens.txt'), num_threads=4)))
lines = json.load(open('lines.json', encoding='utf8'))
SR = 48000; lead = 0.25; out = [np.zeros(int(lead * SR))]; t = lead
for L in lines:
    txt = unicodedata.normalize('NFKD', L['tts'])  # sara am -> nikhahit + sara aa
    bad = {c for c in txt if c not in toks}
    assert not bad, (L['id'], bad)
    a = tts.generate(txt, sid=0, speed=speed)
    x = np.array(a.samples, dtype=np.float32)
    x = resample_poly(x, SR, a.sample_rate)
    # trim near-silence at both ends
    nz = np.where(np.abs(x) > 0.01)[0]; x = x[max(0, nz[0] - 240): nz[-1] + 480]
    L['start'] = round(t, 3); t += len(x) / SR; L['end'] = round(t, 3)
    out.append(x); g = np.zeros(int(L['gap'] * SR)); out.append(g); t += len(g) / SR
y = np.concatenate(out + [np.zeros(int(0.4 * SR))])
y = y / (np.abs(y).max() + 1e-9) * 0.89
w.write('voice.wav', SR, (y * 32767).astype(np.int16))
json.dump(lines, open('lines_timed.json', 'w', encoding='utf8'), ensure_ascii=False, indent=1)
print('total', round(len(y) / SR, 2), 's')
for L in lines: print(L['id'], L['start'], L['end'])
