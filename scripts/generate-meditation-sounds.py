"""Original Ona DSP assets (Ocean, Rain, Storm: retired from the app on 2026-10-17, owner; the
provenance report is in scripts/audio-sources/retired-ambience). Requires numpy and FFmpeg, only during development.

Seeded circular spectral noise + evolving envelopes; no recordings, samples or
external models. Reproduce with --ffmpeg PATH. Lossless masters are reproducible
in .expo/sound/masters; the historical complete delivery bank writes only to
.expo/sound/legacy-dsp. Active acoustic bells are reproduced by master-acoustic-bells.py.
"""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import wave
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
# Historical complete collection. Do not overwrite the live acoustic replacement bank.
OUT = ROOT / ".expo/sound/legacy-dsp"
MASTERS = ROOT / ".expo/sound/masters"
RATE = 24000
SECONDS = 180
TIMELINE_SECONDS = 21600


def write_wav(path, samples):
    samples = np.asarray(samples)
    pcm = np.round(np.clip(samples, -1, 1) * 32767).astype("<i2")
    with wave.open(str(path), "wb") as file:
        file.setnchannels(1 if samples.ndim == 1 else samples.shape[1])
        file.setsampwidth(2)
        file.setframerate(RATE)
        file.writeframes(pcm.tobytes())


def coloured(rng, length, slope, low, high):
    f = np.fft.rfftfreq(length, 1 / RATE)
    # Integer-frequency modes make the *whole* noise process periodic, not a
    # recording chopped at a convenient zero crossing or faded to silence.
    shape = np.maximum(f, 1) ** (-slope)
    shape *= (f / (f + low)) ** 3 / (1 + (f / high) ** 4)
    shape[0] = 0
    spectrum = (rng.normal(size=len(f)) + 1j * rng.normal(size=len(f))) * shape
    noise = np.fft.irfft(spectrum, n=length)
    return noise / np.std(noise)


def bell(fundamental, duration, decay, peak, seed):
    t = np.arange(int(duration * RATE)) / RATE
    rng = np.random.default_rng(seed)
    result = np.zeros_like(t)
    for ratio, gain in [(1, 1), (2.01, .23), (2.76, .11), (4.07, .045), (5.43, .018)]:
        # Slight modal beating, no synthetic melody or sharp mallet transient.
        modal = np.sin(2 * np.pi * fundamental * ratio * t + rng.uniform(-.08, .08))
        modal += .22 * np.sin(2 * np.pi * (fundamental * ratio + .37) * t)
        result += gain * modal * np.exp(-t / (decay / ratio ** .32))
    attack = (1 - np.exp(-t / .07)) ** 2
    end = np.clip((duration - t) / 3, 0, 1)
    result *= attack * (.5 - .5 * np.cos(np.pi * end))
    result *= peak / np.max(np.abs(result))
    result[0] = result[-1] = 0
    return result


def ambience(name, seed):
    rng = np.random.default_rng(seed)
    n = RATE * SECONDS
    t = np.arange(n) / RATE
    common = coloured(rng, n, .55, 70, 6000)
    low = coloured(rng, n, .95, 25, 850)
    # Three long, independent circular modulations prevent a repeated mechanical
    # breathing rhythm; these are audio texture, unrelated to the visual wave.
    evolution = .93 + .04 * np.sin(2*np.pi*t/SECONDS + .2) + .03 * np.sin(6*np.pi*t/SECONDS)
    if name == "brown-noise":
        common = coloured(rng, n, 1, 12, 3200)
        signal = common * evolution
    elif name == "ocean":
        swell = np.zeros(n)
        for centre in np.arange(3, SECONDS, 10) + rng.uniform(-2, 2, 18):
            distance = (t-centre+SECONDS/2) % SECONDS - SECONDS/2
            # Water arrives slowly, foams, and recedes more diffusely.
            width = np.where(distance < 0, 2.1, 3.7)
            swell += rng.uniform(.65, 1.0) * np.exp(-.5*(distance/width)**2)
        foam = coloured(rng, n, .18, 500, 5200)
        signal = .28*low + common*(.18+.42*swell) + .18*foam*swell
    else:
        droplets = coloured(rng, n, .08, 650, 6600)
        patter = .78 + .12*np.sin(18*np.pi*t/SECONDS) + .08*np.sin(46*np.pi*t/SECONDS + .8)
        microtexture = np.minimum(1.6, .6+.4*np.abs(coloured(rng,n,.05,12,65)))
        signal = .48*common + .23*droplets*patter*microtexture + .2*low
        if name == "storm":
            thunder = coloured(rng, n, .75, 15, 180)
            rolls = np.zeros(n)
            for centre in [24, 67, 119, 162]:
                distance = (t-centre+SECONDS/2) % SECONDS - SECONDS/2
                rolls += .34*np.exp(-.5*(distance/6)**2)
            signal = .75*signal + thunder*rolls
    signal *= evolution
    side = coloured(rng, n, .7, 100, 4200)
    stereo = np.column_stack((signal + .1*side, signal - .1*side))
    # Keep absolute and relative levels restrained; no per-frame limiter pumping.
    stereo *= .085 / np.sqrt(np.mean(stereo**2))
    stereo *= min(1, .48 / np.max(np.abs(stereo)))
    return stereo


def metrics(samples):
    x = np.asarray(samples)
    mono = x if x.ndim == 1 else x.mean(axis=1)
    return {"seconds": len(x)/RATE, "peak": float(np.max(np.abs(x))),
            "rms": float(np.sqrt(np.mean(x*x))),
            "dc": float(np.mean(x)),
            "seamStep": float(np.max(np.abs(x[0]-x[-1]))),
            "ordinaryStep99": float(np.quantile(np.abs(np.diff(mono)), .99))}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--ffmpeg", required=True)
    parser.add_argument("--skip-ambience", action="store_true")
    args = parser.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    MASTERS.mkdir(parents=True, exist_ok=True)
    report = {"generator": "ona_original_dsp_v1", "sampleRate": RATE, "assets": {}}
    for name, fundamental, duration, decay, peak, seed in [
        ("starting-bell",196,16,3.8,.34,701),
        ("ending-bell",146.832,24,6,.34,702),
        ("interval-bell",293.665,12,2.8,.23,703)]:
        samples = bell(fundamental,duration,decay,peak,seed)
        path = OUT/(name+".wav")
        write_wav(path,samples)
        report["assets"][path.name] = metrics(samples)
    if not args.skip_ambience:
        for name,seed in [("ocean",801),("rain",802),("storm",803),("brown-noise",804)]:
            samples = ambience(name,seed)
            master = MASTERS/(name+".wav")
            write_wav(master,samples)
            lossless = name == "brown-noise"
            target = OUT/(name+(".flac" if lossless else ".m4a"))
            codec = ["-c:a","flac","-compression_level","8"] if lossless else ["-c:a","aac","-b:a","128k","-movflags","+faststart"]
            subprocess.run([args.ffmpeg,"-y","-v","error","-i",str(master),*codec,str(target)],check=True)
            report["assets"][target.name] = metrics(samples)
            decoded = subprocess.run([args.ffmpeg,"-v","error","-i",str(target),"-f","f32le","-"],check=True,capture_output=True).stdout
            rendered = np.frombuffer(decoded,dtype="<f4").reshape(-1,2)[:RATE*SECONDS].astype(float)
            report["assets"][target.name]["decoded"] = metrics(rendered)
            report["assets"][target.name]["decoded"]["correlationWithMaster"] = float(np.corrcoef(rendered.ravel(),samples.ravel())[0,1])
            print(name,report["assets"][target.name],flush=True)
    # Sparse native timelines continue while JS is asleep. First bell is exactly
    # at the interval, then every interval for six hours, including the final tail.
    # AAC compresses the silence; native players stream rather than decoding it all.
    for minutes in [5,10,15]:
        period = minutes*60
        path = OUT/f"interval-{minutes}m.m4a"
        filters = f"apad=whole_dur={period},aloop=loop={TIMELINE_SECONDS//period-1}:size={period*RATE},adelay={period*1000}:all=1"
        subprocess.run([args.ffmpeg,"-y","-v","error","-i",str(OUT/"interval-bell.wav"),"-af",filters,
                        "-t",str(TIMELINE_SECONDS+12),"-c:a","aac","-b:a","48k","-movflags","+faststart",str(path)],check=True)
        report["assets"][path.name] = {"seconds":TIMELINE_SECONDS+12,"firstBellSeconds":period,"intervalSeconds":period}
        print(path.name,path.stat().st_size,flush=True)
    for name,entry in report["assets"].items():
        asset=OUT/name
        entry.update(bytes=asset.stat().st_size,sha256=hashlib.sha256(asset.read_bytes()).hexdigest())
    (OUT/"analysis.json").write_text(json.dumps(report,indent=2)+"\n",encoding="utf-8")


if __name__ == "__main__":
    main()
