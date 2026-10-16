"""RETIRED 2026-10-16: interval bells now use looped tracks (build-bell-loops.py). Kept as the generator
of the former six-hour timelines (in Git history before 2026-10-16).

Build and verify sparse six-hour AAC timelines from the acoustic interval master.

Requires development-only NumPy/FFmpeg. Native playback advances the silence and
strikes while JavaScript sleeps. No source downloads or ambience regeneration.
"""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import wave

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
BANK = ROOT / "assets/audio/bells-v2"
RATE = 24000
ACTIVE_SECONDS = 21600
TAIL_SECONDS = 12  # Preserve the released six-hour cutoff and final-tail window.


def hash_file(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def window(ffmpeg, path, at, seconds):
    raw = subprocess.run([ffmpeg, "-v", "error", "-ss", str(at), "-i", str(path),
                          "-t", str(seconds), "-ac", "1", "-ar", str(RATE),
                          "-f", "f32le", "-"], check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype="<f4").astype(float)


def verify(ffmpeg, path, period, master):
    before = window(ffmpeg, path, period - .5, .45)
    initial = window(ffmpeg, path, 0, 1)
    first = window(ffmpeg, path, period, TAIL_SECONDS)
    second = window(ffmpeg, path, period * 2, TAIL_SECONDS)
    last = window(ffmpeg, path, ACTIVE_SECONDS, TAIL_SECONDS)
    expected = np.pad(master, (0, TAIL_SECONDS * RATE - len(master)))
    for name, samples in [("first", first), ("second", second), ("last", last)]:
        if len(samples) < len(master):
            raise ValueError(f"Truncated {name} bell: {path}")
    n = min(len(first), len(expected))
    correlation = float(np.corrcoef(first[:n], expected[:n])[0, 1])
    peak = float(np.max(np.abs(first)))
    repeat_error = float(np.sqrt(np.mean((first[:n] - second[:n]) ** 2)))
    last_error = float(np.sqrt(np.mean((first[:n] - last[:n]) ** 2)))
    if not (np.max(np.abs(initial)) < 1e-5 and np.max(np.abs(before)) < .002
            and .03 < peak < .12 and correlation > .98
            and repeat_error < .001 and last_error < .001
            and np.max(np.abs(last[-RATE:])) < .001):
        raise ValueError(f"Timeline signal/timing verification failed: {path}")
    return {"samplePeak": peak, "correlationWithIntervalMaster": correlation,
            "firstSecondRmsDifference": repeat_error, "firstLastRmsDifference": last_error,
            "initialSilencePeak": float(np.max(np.abs(initial))),
            "beforeFirstBellPeak": float(np.max(np.abs(before))),
            "lastSecondPeak": float(np.max(np.abs(last[-RATE:])))}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ffmpeg", required=True)
    parser.add_argument("--verify-only", action="store_true")
    args = parser.parse_args()
    analysis = json.loads((BANK / "analysis.json").read_text(encoding="utf-8"))
    source = BANK / "interval.wav"
    source_hash = hash_file(source)
    if source_hash != analysis["assets"][source.name]["sha256"]:
        raise ValueError("Interval master hash mismatch")
    with wave.open(str(source), "rb") as file:
        if (file.getnchannels(), file.getsampwidth(), file.getframerate()) != (1, 2, RATE):
            raise ValueError("Unexpected interval PCM format")
        master = np.frombuffer(file.readframes(file.getnframes()), dtype="<i2").astype(float) / 32768
    if len(master) > TAIL_SECONDS * RATE:
        raise ValueError("The interval master exceeds the final-tail window")
    report = {"collection": "ona_acoustic_bells_v2", "sourceSha256": source_hash,
              "activeSeconds": ACTIVE_SECONDS, "tailSeconds": TAIL_SECONDS, "assets": {}}
    prior = json.loads((BANK / "timelines.json").read_text(encoding="utf-8")) if args.verify_only else None
    for minutes in (5, 10, 15):
        period = minutes * 60
        path = BANK / f"interval-{minutes}m.m4a"
        if not args.verify_only:
            filters = (f"apad=whole_dur={period},aloop=loop={ACTIVE_SECONDS // period - 1}"
                       f":size={period * RATE},adelay={period * 1000}:all=1")
            subprocess.run([args.ffmpeg, "-y", "-v", "error", "-i", str(source), "-af", filters,
                            "-t", str(ACTIVE_SECONDS + TAIL_SECONDS), "-c:a", "aac", "-b:a", "48k",
                            "-movflags", "+faststart", str(path)], check=True)
        elif hash_file(path) != prior["assets"][path.name]["sha256"] or prior["sourceSha256"] != source_hash:
            raise ValueError(f"Timeline/source hash mismatch: {path}")
        report["assets"][path.name] = {
            "seconds": ACTIVE_SECONDS + TAIL_SECONDS, "intervalSeconds": period,
            "firstBellSeconds": period, "sourceSha256": source_hash,
            "sha256": hash_file(path), "bytes": path.stat().st_size,
            "decoded": verify(args.ffmpeg, path, period, master),
        }
        print(path.name, report["assets"][path.name], flush=True)
    if not args.verify_only:
        (BANK / "timelines.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print("PASS: first/second/final native timeline positions match the acoustic master.")
    print("Native decoding, interruptions and listening remain physical-device checks.")


if __name__ == "__main__":
    main()
