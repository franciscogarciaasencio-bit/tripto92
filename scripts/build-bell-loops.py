"""Build the looped interval tracks: the starting bell, then silence, one file per offered length.

Since 2026-10-17 (owner) the interval bell is the starting bell itself; only the ending bell differs.

Since 2026-10-16 (owner: "intervals configurable at the length the user wants") the interval bell is
one short loop per length instead of three six-hour timelines. Native playback loops the file, so the
bell keeps ringing every N active minutes while JavaScript sleeps; the session controller seeks to
(active seconds mod N minutes) and keeps the very first strike (at 0 s) silent. FLAC is lossless and
gapless at the loop point, and its silence costs almost nothing. Development-only NumPy/FFmpeg.

    python scripts/build-bell-loops.py --ffmpeg /path/to/ffmpeg [--verify-only]
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
# Offered interval lengths in minutes; keep in step with src/data/audio-preferences.ts.
MINUTES = (1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20, 25, 30, 40, 45, 60)


def hash_file(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def decode(ffmpeg, path):
    raw = subprocess.run([ffmpeg, "-v", "error", "-i", str(path), "-ac", "1", "-ar", str(RATE),
                          "-f", "s16le", "-"], check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype="<i2")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ffmpeg", required=True)
    parser.add_argument("--verify-only", action="store_true")
    args = parser.parse_args()
    analysis = json.loads((BANK / "analysis.json").read_text(encoding="utf-8"))
    source = BANK / "start.wav"
    source_hash = hash_file(source)
    if source_hash != analysis["assets"][source.name]["sha256"]:
        raise ValueError("Starting bell hash mismatch")
    with wave.open(str(source), "rb") as file:
        if (file.getnchannels(), file.getsampwidth(), file.getframerate()) != (1, 2, RATE):
            raise ValueError("Unexpected starting bell PCM format")
        master = np.frombuffer(file.readframes(file.getnframes()), dtype="<i2")
    prior = json.loads((BANK / "loops.json").read_text(encoding="utf-8")) if args.verify_only else None
    report = {"collection": "ona_acoustic_bells_v2", "sourceSha256": source_hash, "sampleRate": RATE,
              "format": "mono 16-bit FLAC, starting bell at 0 s then silence", "assets": {}}
    for minutes in MINUTES:
        period = minutes * 60
        if len(master) >= period * RATE:
            raise ValueError("The starting bell is longer than the shortest loop")
        path = BANK / f"interval-loop-{minutes}m.flac"
        expected = np.zeros(period * RATE, dtype="<i2")
        expected[:len(master)] = master
        if not args.verify_only:
            subprocess.run([args.ffmpeg, "-y", "-v", "error", "-f", "s16le", "-ar", str(RATE), "-ac", "1", "-i", "-",
                            "-c:a", "flac", "-compression_level", "12", "-map_metadata", "-1", "-fflags", "+bitexact",
                            "-flags:a", "+bitexact", str(path)], input=expected.tobytes(), check=True)
        elif hash_file(path) != prior["assets"][path.name]["sha256"] or prior["sourceSha256"] != source_hash:
            raise ValueError(f"Loop/source hash mismatch: {path}")
        decoded = decode(args.ffmpeg, path)
        if len(decoded) != len(expected) or not np.array_equal(decoded, expected):
            raise ValueError(f"Loop is not sample-exact: {path}")
        report["assets"][path.name] = {"minutes": minutes, "seconds": period, "sha256": hash_file(path),
                                       "bytes": path.stat().st_size, "samples": int(len(decoded))}
        print(path.name, report["assets"][path.name]["bytes"], flush=True)
    if not args.verify_only:
        (BANK / "loops.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    total = sum(entry["bytes"] for entry in report["assets"].values())
    print(f"PASS: {len(MINUTES)} sample-exact loops, {total / 1e6:.2f} MB. Native looping and listening remain device checks.")


if __name__ == "__main__":
    main()
