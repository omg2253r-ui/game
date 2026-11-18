# Sound for the Na Yai Am short: an original light Thai-flavoured score (major pentatonic, plucked "khim"-like
# strings, a glockenspiel standing in for the ranat, small "ching" cymbals, a soft drum, a warm pad), synthesized
# sound effects timed to the picture (story.ts + cast.ts mirrored below), and the mix: music ducked under the
# voice at about -10 LU, effects about -12 LU, voice unchanged; master -15 LUFS, true peak <= -1.2 dBTP.
# Usage: python build_audio.py   (reads ../voice/voice.wav + lines_timed.json; writes mix.wav, stems, cues.md)
import json, os, math
import numpy as np
from scipy import ndimage
from dsp import (SR, ns, rng, pan, place, fades, dbg, make_ir, convolve_st, integrated, lp, hp, bp, read_wav, write_wav,
                 true_peak, modal, tt, phase)
import instruments as I
import sfx_gen as S

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
FPS, TOTAL = 30, 2010
DUR = TOTAL / FPS
N = ns(DUR)
LINES = json.load(open(os.path.join(ROOT, "voice", "lines_timed.json"), encoding="utf8"))
L = {l["id"]: l for l in LINES}


def word_at(lid, phrase):
    """same estimate as story.ts wordAt: start of a phrase by its share of the line's characters"""
    l = L[lid]
    txt, p = l["tts"].replace(" ", ""), phrase.replace(" ", "")
    i = txt.index(p)
    return l["start"] + (l["end"] - l["start"]) * i / len(txt)


fr = lambda f: f / FPS
T_APPROVE = word_at("approve", "อนุญาต")
T_DISTRICT = word_at("twist", "ก็ได้เป็นอำเภอ")
T_WAIT = word_at("end", "แล้วยืนรอ")
T_GIVE = word_at("petition", "ยื่นขอ") + 0.35
T_BUILD0, T_BUILD1 = L["build"]["start"], L["build"]["end"] + 0.3
SHOTS = {1: (0, 126), 2: (126, 350), 3: (350, 530), 4: (530, 664), 5: (664, 828), 6: (828, 1002), 7: (1002, 1058),
         8: (1058, 1150), 9: (1150, 1376), 10: (1376, 1590), 11: (1590, 1734), 12: (1734, TOTAL)}
st_ = lambda i: (fr(SHOTS[i][0]), fr(SHOTS[i][1]))
FLASH = fr(126)

# ================================================================ score
BPM = 104.0
Q = 60.0 / BPM
m2f = I.m2f
C4, D4, E4, G4, A4 = 60, 62, 64, 67, 69
PENTA = [0, 2, 4, 7, 9]


def deg(n, base=72):
    """pentatonic degree n (0 = C5) -> midi"""
    o, k = divmod(n, 5)
    return base + 12 * o + PENTA[k]


# main theme (8 beats each phrase), pentatonic degrees, (beat, degree, beats)
THEME_A = [(0, 2, 1), (1, 3, 1), (2, 4, 1), (3, 3, 0.5), (3.5, 2, 0.5), (4, 1, 1), (5, 2, 1), (6, 0, 2)]
THEME_B = [(0, 3, 1), (1, 4, 1), (2, 5, 1.5), (3.5, 4, 0.5), (4, 3, 1), (5, 2, 0.5), (5.5, 1, 0.5), (6, 2, 2)]
THEME_C = [(0, 4, 0.5), (0.5, 5, 0.5), (1, 6, 1), (2, 5, 1), (3, 4, 1), (4, 3, 1), (5, 4, 1), (6, 5, 2)]
CHORDS = {"C": [48, 55, 60, 64], "Am": [45, 52, 57, 60], "G": [43, 50, 55, 59], "F": [41, 48, 53, 57], "Dm": [50, 57, 62, 65]}


class Band:
    def __init__(self):
        self.tr = {}

    def add(self, name, x, t, p=0.0, g=1.0):
        if name not in self.tr:
            self.tr[name] = np.zeros((2, N + ns(4)))
        if t < -1 or t > DUR:
            return
        place(self.tr[name], pan(x, p) if np.ndim(x) == 1 else x, t, g)


R = rng(2526)


def melody(b, t0, phrase, inst="glock", vel=0.6, octave=0, p=0.15, gate=0.9, until=None):
    for beat, d, beats in phrase:
        t = t0 + beat * Q
        if until is not None and t >= until:
            break
        f = m2f(deg(d) + 12 * octave)
        if inst == "glock":
            b.add("ranat", I.glock(f, vel, R, dur=1.4), t, p)
        elif inst == "pluck":
            b.add("khim", I.pluck(f, vel, R, dur=1.2, bright=0.7), t, p)
        elif inst == "vibes":
            b.add("vibes", I.vibes(f, vel, R, dur=max(0.6, beats * Q * 1.6)), t, p)
        elif inst == "trem":  # khim tremolo: fast repeated plucks
            n = max(2, int(beats * Q / 0.09))
            for k in range(n):
                b.add("khim", I.pluck(f, vel * (0.75 + 0.25 * (k == 0)), R, dur=0.4, bright=0.6), t + k * 0.09, p)


def ostinato(b, t0, t1, chord, vel=0.35, p=-0.25, pattern=(0, 2, 1, 3)):
    """khim broken-chord ostinato in eighths"""
    notes = CHORDS[chord]
    k, t = 0, t0
    while t < t1 - 0.02:
        n = notes[pattern[k % len(pattern)]] + 12
        b.add("khim", I.pluck(m2f(n), vel * (1.0 if k % 2 == 0 else 0.75), R, dur=0.8, bright=0.45), t, p + 0.1 * (k % 2))
        t += Q / 2
        k += 1


def ching(b, t0, t1, vel=0.3, every=2, off=1):
    """small Thai finger cymbals: open 'ching' on the off-beat, damped 'chap' between"""
    k, t = 0, t0
    while t < t1 - 0.01:
        if k % every == off:
            b.add("ching", I.triangle(vel, R, dur=0.9, f=2650), t, 0.35)
        elif every > 1:
            b.add("ching", I.triangle(vel * 0.45, R, dur=0.12, f=2650), t, 0.35)
        t += Q
        k += 1


def drum(b, t0, t1, vel=0.45, pat="tm"):
    """soft frame drum: low 'tung' on 1 and 3, a lighter 'tak' on the and of 4"""
    t, k = t0, 0
    while t < t1 - 0.01:
        beat = k % 4
        if beat in (0, 2):
            b.add("drum", I.timpani(92 if beat == 0 else 104, vel, R, dur=0.7), t, -0.1)
        if pat == "busy" and beat in (1, 3):
            b.add("drum", I.brush(vel * 0.8, R, dur=0.2), t + Q / 2, 0.2)
        t += Q
        k += 1


def pad(b, t0, t1, chord, vel=0.25):
    b.add("pad", I.pad([m2f(n + 12) for n in CHORDS[chord][1:]], t1 - t0, vel, R, att=0.5, rel=0.8, warm=1100), t0)


def build_score():
    b = Band()
    # ---- hook (0 - flash): bright ranat theme over drum + ching, lands on the flash
    t0 = 0.12
    melody(b, t0, THEME_A, "glock", 0.55, 0, until=FLASH - 0.05)
    ching(b, t0, FLASH - 0.1, 0.32)
    drum(b, t0, FLASH - 0.1, 0.4)
    pad(b, t0, FLASH, "C", 0.18)
    b.add("ranat", I.glock(m2f(84), 0.6, R), FLASH, 0.2)  # sparkle on the flash
    # ---- village (setting, problem): gentle khim ostinato, soft melody
    a, e = FLASH + 0.1, st_(4)[0]
    for i, (ch, ph) in enumerate([("C", THEME_A), ("Am", THEME_B), ("F", THEME_A), ("G", THEME_C)] * 2):
        ts = a + i * 8 * Q
        if ts >= e - 0.2:
            break
        te = min(e, ts + 8 * Q)
        ostinato(b, ts, te, ch, 0.28)
        pad(b, ts, te, ch, 0.14)
        if i % 2 == 0 and i < 4:
            melody(b, ts, ph, "vibes", 0.32, -1, until=te)
    # problem shot: the melody thins to a lonely tremolo
    melody(b, st_(3)[0] + 0.2, [(0, 2, 2), (2, 1, 2), (4, 0, 3)], "trem", 0.3, -1, until=st_(4)[0])
    # ---- gather + petition: drum pulse, the theme in the ranat, building
    a, e = st_(4)[0], st_(6)[0]
    drum(b, a, e, 0.4)
    ching(b, a, e, 0.28)
    for i, (ch, ph) in enumerate([("C", THEME_A), ("Am", THEME_B), ("F", THEME_A), ("G", THEME_C), ("C", THEME_B)]):
        ts = a + i * 8 * Q
        if ts >= e - 0.2:
            break
        te = min(e, ts + 8 * Q)
        ostinato(b, ts, te, ch, 0.3)
        melody(b, ts, ph, "glock", 0.42, 0, until=te)
        pad(b, ts, te, ch, 0.16)
    # ---- the approval: suspense (ticking ching, held pad), dead stop, a hit on "อนุญาต"
    a = st_(6)[0]
    k, t = 0, a
    while t < T_APPROVE - 0.15:
        b.add("ching", I.triangle(0.18 + 0.2 * (t - a) / (T_APPROVE - a), R, dur=0.1, f=2650), t, 0.35)
        t += Q / (2 if t > T_APPROVE - 1.6 else 1)
    pad(b, a, T_APPROVE - 0.12, "Dm", 0.2)
    b.add("drum", I.timpani(70, 0.9, R, dur=2.0), T_APPROVE, 0)
    b.add("ching", I.cymbal(0.5, R, dur=2.2), T_APPROVE, 0.1)
    for n in (72, 76, 79, 84):  # bright major chord blooms after the stamp
        b.add("ranat", I.glock(m2f(n), 0.45, R, dur=2.0), T_APPROVE + 0.05, 0.1)
    # ---- lucky: a quick happy run
    a = L["lucky"]["start"] - 0.1
    melody(b, a, [(0, 0, 0.5), (0.5, 2, 0.5), (1, 4, 0.5), (1.5, 5, 1)], "glock", 0.5, 0)
    ching(b, a, a + 4 * Q, 0.3, 1, 0)
    # ---- unlucky: a deflating descending khim + a lone low drum
    a = L["unlucky"]["start"] - 0.05
    for i, d in enumerate([5, 4, 3, 2, 0]):
        b.add("khim", I.pluck(m2f(deg(d) - 12), 0.45, R, dur=1.0, bright=0.3), a + i * 0.32, -0.1)
    b.add("drum", I.timpani(62, 0.5, R, dur=1.4), a + 5 * 0.32, 0)
    # ---- building: busy and cheerful (drum, ching, ostinato, theme) up to the opening
    a, e = st_(9)[0] + 0.1, st_(10)[0]
    drum(b, a, e, 0.45, "busy")
    ching(b, a, e, 0.3)
    for i, (ch, ph) in enumerate([("C", THEME_A), ("F", THEME_B), ("Am", THEME_C), ("G", THEME_A), ("C", THEME_B), ("F", THEME_C), ("G", THEME_A)]):
        ts = a + i * 8 * Q
        if ts >= e - 0.2:
            break
        te = min(e, ts + 8 * Q)
        ostinato(b, ts, te, ch, 0.32)
        melody(b, ts, ph, "glock" if i % 2 == 0 else "pluck", 0.42, 0, until=te)
    # ---- opening day: warm, the theme on vibes with the pad
    a, e = st_(10)[0], st_(11)[0]
    for i, (ch, ph) in enumerate([("C", THEME_A), ("Am", THEME_B), ("F", THEME_A), ("G", THEME_C), ("C", THEME_A)]):
        ts = a + i * 8 * Q
        if ts >= e - 0.2:
            break
        te = min(e, ts + 8 * Q)
        pad(b, ts, te, ch, 0.2)
        ostinato(b, ts, te, ch, 0.24)
        melody(b, ts, ph, "vibes", 0.38, 0, until=te)
    ching(b, a, e, 0.22, 4, 1)
    # ---- today: grand golden version (ranat + vibes in octaves, cymbal swell into it)
    a, e = st_(11)[0], st_(12)[0]
    b.add("ching", I.cymbal(0.35, R, dur=2.5), a - 0.05, -0.2)
    for i, (ch, ph) in enumerate([("C", THEME_C), ("F", THEME_A), ("G", THEME_B)]):
        ts = a + i * 8 * Q
        if ts >= e - 0.2:
            break
        te = min(e, ts + 8 * Q)
        pad(b, ts, te, ch, 0.26)
        ostinato(b, ts, te, ch, 0.3)
        melody(b, ts, ph, "glock", 0.45, 0, until=te)
        melody(b, ts, ph, "vibes", 0.3, -1, until=te)
    drum(b, a, e, 0.38)
    # ---- twist: suspense tremolo, a hit when the district sign springs up, then a light cheeky tag to the end
    a = st_(12)[0]
    melody(b, a + 0.1, [(0, 0, 2), (2, 1, 2), (4, 2, 2), (6, 3, 2)], "trem", 0.28, -1, until=T_DISTRICT - 0.1)
    pad(b, a, T_DISTRICT - 0.1, "Am", 0.2)
    b.add("drum", I.timpani(78, 0.85, R, dur=1.6), T_DISTRICT + 0.12, 0)
    b.add("ching", I.cymbal(0.45, R, dur=2.0), T_DISTRICT + 0.12, 0.1)
    for n in (67, 72, 76):
        b.add("ranat", I.glock(m2f(n + 12), 0.4, R, dur=1.6), T_DISTRICT + 0.15, 0.15)
    a = T_DISTRICT + 1.0
    ostinato(b, a, DUR - 0.9, "C", 0.24)
    ching(b, a, DUR - 0.9, 0.22, 2, 1)
    melody(b, a + 4 * Q, THEME_A, "pluck", 0.36, 0, until=DUR - 1.2)
    # final cadence: a plucked C chord that rings out under the last word, ending with the picture
    for i, n in enumerate((60, 64, 67, 72, 76)):
        b.add("khim", I.pluck(m2f(n), 0.4, R, dur=1.6), T_WAIT + 0.15 + i * 0.05, -0.2 + 0.1 * i)
    b.add("ranat", I.glock(m2f(84), 0.4, R, dur=1.6), T_WAIT + 0.45, 0.2)
    return b


BAL = {"ranat": -2.0, "khim": -1.0, "vibes": -3.0, "ching": -8.0, "drum": -4.0, "pad": -6.0}


def render_score(b):
    out = np.zeros((2, N + ns(4)))
    for name, x in b.tr.items():
        out += x * dbg(BAL.get(name, 0.0))
    ir = make_ir(1.2, 7, hf=0.6)
    wet = convolve_st(out * 0.25, ir)[:, : out.shape[1]]
    out = out + wet
    out = out[:, :N]
    out[:, -ns(0.4):] *= np.linspace(1, 0, ns(0.4))[None, :]
    return out


# ================================================================ effects
def build_sfx():
    r = rng(16)
    beds = np.zeros((2, N))
    ev = np.zeros((2, N))
    cues = []

    def cue(t, what, g=1.0):
        cues.append((t, what))

    def put(x, t, g=1.0, p=0.0, what=None):
        place(ev, pan(x, p) if np.ndim(x) == 1 else x, t, g)
        if what:
            cue(t, what)

    # ambience beds: village (birds, breeze) for 1983, campus (birds, flag, far kids) for today
    def bed(a, b2, kind):
        d = b2 - a + 0.6
        x = S.breeze(d, r, 0.25, bright=700)
        x += pan(S.bird_chirps(d, r, 0.5, "sparrow"), -0.4) * 0.35 + pan(S.bird_chirps(d, r, 0.25, "blackbird"), 0.5) * 0.25
        if kind == "now":
            x += pan(S.flag_flutter(d, r), 0.3) * 0.08
            for v in range(4):
                x += pan(S.babble(d, r, 260 + 40 * v, 1.25, 4.6, 0.55), -0.6 + 0.4 * v) * 0.05
        n = x.shape[1]
        x[:, : ns(0.25)] *= np.linspace(0, 1, ns(0.25))[None, :]
        x[:, -ns(0.3):] *= np.linspace(1, 0, ns(0.3))[None, :]
        place(beds, x, a - 0.1)
        cue(a, f"bed {kind}")

    bed(0.0, FLASH, "now")
    bed(FLASH, st_(6)[0], "then")
    bed(st_(7)[0], st_(11)[0], "then")
    bed(st_(11)[0], DUR, "now")
    # desk insert: quiet room tone
    place(beds, S.breeze(st_(6)[1] - st_(6)[0], r, 0.06, bright=300), st_(6)[0])

    # whooshes on the big camera moves and cuts
    put(S.whoosh(1.1, r, 0.55), fr(64 + 20) - 0.55, 0.6, 0.0, "whoosh: rise over the campus")
    put(S.whoosh(0.6, r, 0.25, 600, 3000), FLASH - 0.25, 0.5, 0.0, "whoosh: flash to 1983")
    put(S.whoosh(0.7, r, 0.35), st_(11)[0] - 0.35, 0.45, 0.0, "whoosh: to today")
    # road kid: a stronger gust down the long road
    put(S.breeze(st_(3)[1] - st_(3)[0], r, 0.6, gust=0.3, bright=1100), st_(3)[0], 0.5, 0, "wind down the long road")
    # gather: footsteps arriving + villagers talking
    for i in range(18):
        arrive = st_(4)[0] + 0.6 + S_hh(i, 3) * 1.6 + (i // 6) * 0.5
        for k in range(5):
            put(S.stroll_step(r, 0.8), arrive - 2.6 + k * 0.52 + 0.1 * S_hh(i, 4), 0.18, -0.6 + 0.07 * i)
    for v in range(6):
        put(S.babble(st_(5)[1] - st_(4)[0] - 0.5, r, 140 + 25 * v if v % 2 else 220 + 20 * v, 1.0 + 0.1 * v, 4.0, 0.6), st_(4)[0] + 0.8, 0.09, -0.7 + 0.28 * v)
    cue(st_(4)[0], "villagers arrive and talk")
    # petition: paper hand-over
    put(I.brush(0.8, r, 0.35, swish=True), T_GIVE - 0.1, 0.9, 0.1, "paper hand-over")
    # the stamp
    put(stamp_thump(r), T_APPROVE, 1.3, 0, "STAMP on 'อนุญาต'")
    # lucky: kids cheer
    for k in range(6):
        put(S.hurrah(r, 300 + 40 * k, 1.35, kid=True), L["lucky"]["start"] - 0.05 + 0.08 * k, 0.35, -0.6 + 0.24 * k)
    cue(L["lucky"]["start"], "kids cheer")
    # unlucky: wind gust over the empty plot
    put(S.breeze(3.0, r, 0.9, gust=0.5, bright=1500), st_(8)[0], 0.55, 0, "gust over the empty plot")
    # building: hammer strikes exactly where the hammers land (cast.ts HAMMER_AT reaches 1 at phase .75)
    a, b2 = st_(9)
    for i in range(3):
        n = math.ceil(a * 1.6 + i * 0.37 - 0.75)
        while True:
            th = (n + 0.75 - i * 0.37) / 1.6
            if th >= b2:
                break
            if th >= a:
                put(S.hammer_hit(r, 0.55), th, 0.42 if th < fr(1270) else 0.22, -0.4 + 0.4 * i)
            n += 1
    cue(a, "hammers on the frame (synced)")
    for k in range(int((b2 - a) / 0.55)):
        put(S.stroll_step(r, 0.5), a + 0.3 + k * 0.55, 0.12, 0.3)
    for v in range(4):
        put(S.babble(b2 - a - 0.4, r, 150 + 30 * v, 1.0, 4.4, 0.5), a + 0.2, 0.07, -0.5 + 0.33 * v)
    # opening day: the school's hand bell, kids' footsteps and chatter
    put(hand_bell(r), st_(10)[0] + 0.15, 0.7, 0.2, "hand bell: first day")
    for k in range(int((st_(10)[1] - st_(10)[0]) / 0.33)):
        put(S.stroll_step(r, 0.3), st_(10)[0] + 0.2 + k * 0.33, 0.1, -0.2 + 0.4 * (k % 2))
    for v in range(4):
        put(S.babble(3.4, r, 280 + 30 * v, 1.3, 5.0, 0.55), st_(10)[0] + 0.3, 0.06, -0.5 + 0.33 * v)
    # twist: a rising whoosh into the district sign, a boing as it springs up, a little giggle at the end
    put(S.whoosh(1.2, r, 1.0, 300, 2600), T_DISTRICT - 1.0 + 0.12, 0.55, 0.2, "rise into the district sign")
    put(boing(r), T_DISTRICT + 0.12, 0.8, 0.25, "district sign springs up")
    put(thud(r), T_DISTRICT + 0.12, 1.0, 0.25)
    for k in range(2):
        put(S.hurrah(r, 330 + 50 * k, 1.4, kid=True), T_WAIT + 0.9 + 0.15 * k, 0.18, -0.4 + 0.3 * k)
    cue(T_WAIT, "kids' little cheer under 'ยืนรอ'")
    return beds, ev, cues


def S_hh(i, s=0):
    v = math.sin(i * 127.1 + s * 311.7) * 43758.5453
    return v - math.floor(v)


def stamp_thump(r):
    d = 0.8
    t = tt(d)
    body = np.exp(-t / 0.06) * np.sin(phase(75 * (1 + 0.6 * np.exp(-t / 0.012))))
    slap = bp(r.standard_normal(len(t)), 300, 5000, 1) * np.exp(-t / 0.012)
    wood = modal(d, [(210, 1.0, 0.08), (520, 0.6, 0.05), (980, 0.3, 0.03)], r)
    return fades(body * 1.4 + slap * 0.8 + wood * 0.8, 0.0, 0.1)


def hand_bell(r):
    d = 2.2
    y = np.zeros(ns(d))
    for k in range(6):
        b = modal(1.6, [(1180, 1.0, 0.9), (2630, 0.5, 0.5), (4120, 0.25, 0.3)], r)
        place_mono(y, b * (0.9 - 0.08 * k), k * 0.16)
    return y


def boing(r):
    d = 0.9
    t = tt(d)
    f = 180 * (1 + 0.5 * np.exp(-t / 0.25) * np.sin(2 * np.pi * 11 * t))
    return fades(np.sin(phase(f)) * np.exp(-t / 0.35) * 0.8, 0.002, 0.1)


def thud(r):
    d = 0.7
    t = tt(d)
    return fades(np.exp(-t / 0.09) * np.sin(phase(55 * (1 + 0.8 * np.exp(-t / 0.02)))) * 1.2 + lp(r.standard_normal(len(t)), 400) * np.exp(-t / 0.03) * 0.6, 0, 0.1)


def place_mono(buf, x, t):
    i = ns(t)
    j = min(len(buf), i + len(x))
    if j > i:
        buf[i:j] += x[: j - i]


# ================================================================ mix
def speech_env():
    """1 while a line is spoken (with a short pre/post), smoothed -> ducking key"""
    k = np.zeros(N)
    for l in LINES:
        k[ns(l["start"] - 0.08): ns(l["end"] + 0.12)] = 1
    return ndimage.uniform_filter1d(k, ns(0.15), mode="nearest")


def limiter(x, ceil_db=-1.6, look=0.003, rel=0.08):
    c = dbg(ceil_db)
    a = np.abs(x).max(0)
    need = np.minimum(1.0, c / np.maximum(a, 1e-9))
    need = ndimage.minimum_filter1d(need, ns(look) * 2 + 1)
    g = np.empty_like(need)
    k = math.exp(-1 / (rel * SR))
    cur = 1.0
    for i in range(len(need)):  # fast attack (already looked-ahead), slow release
        cur = need[i] if need[i] < cur else need[i] + (cur - need[i]) * k
        g[i] = cur
    return x * g[None, :], g


def main():
    v, sr = read_wav(os.path.join(ROOT, "voice", "voice.wav"))
    assert sr == SR
    v = np.vstack([v[0], v[0]]) if v.shape[0] == 1 else v
    vv = np.zeros((2, N))
    vv[:, : min(N, v.shape[1])] = v[:, :N]
    Lv = integrated(vv)
    print(f"voice {Lv:.2f} LUFS")
    m = render_score(build_score())
    duck = 1 - (1 - dbg(-4.0)) * speech_env()
    m = m * duck[None, :]
    m *= dbg(Lv - 10.0 - integrated(m))
    beds, ev, cues = build_sfx()
    sfx = beds * dbg(-4.0) + ev
    sfx *= dbg(Lv - 12.0 - integrated(sfx))
    mix0 = vv + m + sfx
    G = -15.0 - integrated(mix0)
    for it in range(4):
        y, g = limiter(mix0 * dbg(G))
        Lm = integrated(y)
        if abs(Lm + 15.0) < 0.05:
            break
        G += -15.0 - Lm
    print(f"master gain {G:+.2f} dB -> {integrated(y):.2f} LUFS, TP {true_peak(y):.2f} dBTP, max GR {-20 * np.log10(g.min()):.2f} dB")
    write_wav(os.path.join(HERE, "mix.wav"), y)
    write_wav(os.path.join(HERE, "stem_voice.wav"), vv * dbg(G))
    write_wav(os.path.join(HERE, "stem_music.wav"), m * dbg(G))
    write_wav(os.path.join(HERE, "stem_sfx.wav"), sfx * dbg(G))
    with open(os.path.join(HERE, "cues.md"), "w", encoding="utf8") as f:
        f.write(f"# Cue sheet ({DUR:.3f} s, 48 kHz)\n\nMusic: original pentatonic score, about -10 LU under the voice, ducked 4 dB while it speaks. "
                f"Effects about -12 LU. Master {integrated(y):.2f} LUFS, true peak {true_peak(y):.2f} dBTP.\n\n| time (s) | frame | cue |\n|---|---|---|\n")
        for t, w in sorted(cues):
            f.write(f"| {t:.2f} | {round(t * FPS)} | {w} |\n")
    print("wrote mix.wav", y.shape[1] / SR, "s")


if __name__ == "__main__":
    main()
