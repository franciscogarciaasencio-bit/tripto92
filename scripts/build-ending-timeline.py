"""Build and verify the sparse ending timeline for fixed-length practice.

One hour of digital silence followed by the exact acoustic End master. Playback seeks so
the bell sounds when the chosen active duration is reached, even while JavaScript sleeps
on a locked phone. Requires development-only NumPy/FFmpeg. Interval timelines and the
End master itself are not modified.
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
LEAD_SECONDS = 3600  # Longest fixed practice offered: 60 minutes.
OUTPUT = BANK / "ending-timeline.m4a"
REPORT = BANK / "ending-timeline.json"


def hash_file(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def window(ffmpeg, path, at, seconds):
    raw = subprocess.run([ffmpeg, "-v", "error", "-ss", str(at), "-i", str(path), "-t", str(seconds),
                          "-ac", "1", "-ar", str(RATE), "-f", "f32le", "-"], check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype="<f4").astype(float)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ffmpeg", required=True)
    parser.add_argument("--verify-only", action="store_true")
    args = parser.parse_args()
    analysis = json.loads((BANK / "analysis.json").read_text(encoding="utf-8"))
    source = BANK / "end.wav"
    source_hash = hash_file(source)
    if source_hash != analysis["assets"][source.name]["sha256"]:
        raise ValueError("End master hash mismatch")
    with wave.open(str(source), "rb") as file:
        if (file.getnchannels(), file.getsampwidth(), file.getframerate()) != (1, 2, RATE):
            raise ValueError("Unexpected End PCM format")
        master = np.frombuffer(file.readframes(file.getnframes()), dtype="<i2").astype(float) / 32768
    tail = len(master) / RATE
    if not args.verify_only:
        subprocess.run([args.ffmpeg, "-y", "-v", "error", "-i", str(source),
                        "-af", f"adelay={LEAD_SECONDS * 1000}:all=1", "-c:a", "aac", "-b:a", "48k",
                        "-movflags", "+faststart", str(OUTPUT)], check=True)
    elif hash_file(OUTPUT) != json.loads(REPORT.read_text(encoding="utf-8"))["sha256"]:
        raise ValueError("Ending timeline hash mismatch")
    initial = window(args.ffmpeg, OUTPUT, 0, 1)
    before = window(args.ffmpeg, OUTPUT, LEAD_SECONDS - .5, .45)
    bell = window(args.ffmpeg, OUTPUT, LEAD_SECONDS, tail + 1)
    if len(bell) < len(master):
        raise ValueError("Truncated ending bell")
    n = len(master)
    correlation = float(np.corrcoef(bell[:n], master)[0, 1])
    peak = float(np.max(np.abs(bell)))
    if not (np.max(np.abs(initial)) < 1e-5 and np.max(np.abs(before)) < .002 and correlation > .98
            and abs(peak - float(np.max(np.abs(master)))) < .02):
        raise ValueError("Ending timeline signal/timing verification failed")
    report = {"collection": "ona_acoustic_bells_v2", "leadSeconds": LEAD_SECONDS, "tailSeconds": tail,
              "sourceSha256": source_hash, "sha256": hash_file(OUTPUT), "bytes": OUTPUT.stat().st_size,
              "decoded": {"correlationWithEndMaster": correlation, "samplePeak": peak,
                          "initialSilencePeak": float(np.max(np.abs(initial))),
                          "beforeBellPeak": float(np.max(np.abs(before)))}}
    if not args.verify_only:
        REPORT.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))
    print("PASS: the ending bell begins exactly after the one-hour lead and matches the End master.")


if __name__ == "__main__":
    main()
