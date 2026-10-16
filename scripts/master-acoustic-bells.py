"""Reproduce the acoustic bell bank. Regenerate interval timelines after changing it.

Requires development-only NumPy and FFmpeg; no downloads or runtime dependency.
Profiles are intentionally gentle: preserve pitch/natural decay, soften the strike,
reduce upper partials, then apply constant gain (no compressor or reverb).

--roles renders only the named clips and keeps every other entry of analysis.json (and its
bytes) as it is, so one bell can change without re-rounding the others on a different FFmpeg.
"""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import wave

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
SOURCES = ROOT / "scripts/audio-sources/bells"
OUTPUT = ROOT / "assets/audio/bells-v2"
RATE = 24000
PROFILES = {
    "start": {"source": "2553", "trimSeconds": 0, "attackMs": 65,
              "tailSeconds": 1.2, "shelfHz": 1600, "shelfDb": -5,
              "firstTwoSecondsRms": .036},
    "end": {"source": "1110", "trimSeconds": .088, "attackMs": 120,
            "tailSeconds": 2, "shelfHz": 1300, "shelfDb": -10,
            "firstTwoSecondsRms": .034},
    # The owner's gong (2026-10-15): keep its strike and colour, only the pre-strike lead trimmed.
    # Until then: {"source": "2554", "trimSeconds": 0, "attackMs": 85, "tailSeconds": 1.4,
    # "shelfHz": 1500, "shelfDb": -9, "firstTwoSecondsRms": .022}.
    # 2026-10-16: the owner found it too quiet to hear mid-practice (opening RMS .022, about
    # -35.5 LUFS); now a little above the starting bell so it carries over ambience.
    "interval": {"source": "gong-4", "trimSeconds": .045, "attackMs": 30,
                 "tailSeconds": 1.4, "shelfHz": 2000, "shelfDb": -3,
                 "firstTwoSecondsRms": .045},
}


def all_sources(provenance):
    """Publisher recordings and owner-supplied files, by ID."""
    return {**provenance["sources"], **provenance.get("ownerSupplied", {})}


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def decode(ffmpeg, path, filters=None):
    command = [ffmpeg, "-v", "error", "-i", str(path)]
    if filters:
        command += ["-af", filters]
    raw = subprocess.run(command + ["-ac", "1", "-ar", str(RATE),
                                   "-f", "f64le", "-"], check=True,
                         capture_output=True).stdout
    samples = np.frombuffer(raw, dtype="<f8").copy()
    if not len(samples) or not np.all(np.isfinite(samples)):
        raise ValueError(f"Invalid decoded audio: {path}")
    return samples


def rms(samples):
    return float(np.sqrt(np.mean(samples ** 2)))


def measurements(samples):
    # Whole-clip band energies, not a subjective loudness/quality measurement.
    spectrum = np.abs(np.fft.rfft(samples)) ** 2
    frequencies = np.fft.rfftfreq(len(samples), 1 / RATE)
    energy = float(np.sum(spectrum))
    return {
        "seconds": len(samples) / RATE,
        "samplePeak": float(np.max(np.abs(samples))),
        "dc": float(np.mean(samples)),
        "first20msRms": rms(samples[:int(.02 * RATE)]),
        "firstTwoSecondsRms": rms(samples[:2 * RATE]),
        "lastSecondRms": rms(samples[-RATE:]),
        "energyAbove2000HzFraction": float(np.sum(spectrum[frequencies > 2000]) / energy),
        "rmsPerSecond": [rms(samples[i:i + RATE]) for i in range(0, len(samples), RATE)],
    }


def master(ffmpeg, source, profile):
    # Filter at source rate before 24 kHz delivery. No pitch shift or time stretch.
    filters = (f"atrim=start={profile['trimSeconds']},highpass=f=65,"
               f"treble=g={profile['shelfDb']}:f={profile['shelfHz']}:t=q:w=0.707,"
               "lowpass=f=5500")
    samples = decode(ffmpeg, source, filters)
    attack = round(profile["attackMs"] * RATE / 1000)
    tail = round(profile["tailSeconds"] * RATE)
    samples[:attack] *= .5 - .5 * np.cos(np.linspace(0, np.pi, attack))
    samples[-tail:] *= .5 + .5 * np.cos(np.linspace(0, np.pi, tail))
    gain = min(profile["firstTwoSecondsRms"] / rms(samples[:2 * RATE]),
               .25 / np.max(np.abs(samples)))
    samples *= gain
    # PCM rounding is deterministic; quiet tails already fall below 16-bit resolution.
    pcm = np.rint(samples * 32767).astype("<i2")
    pcm[0] = pcm[-1] = 0
    return pcm, filters, float(gain)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ffmpeg", required=True)
    parser.add_argument("--output", type=Path, default=OUTPUT,
                        help="Optional alternate directory for reproducibility verification")
    parser.add_argument("--roles", nargs="+", choices=sorted(PROFILES), default=sorted(PROFILES),
                        help="Render only these clips; other analysis entries and files stay as they are")
    args = parser.parse_args()
    provenance = json.loads((SOURCES / "provenance.json").read_text(encoding="utf-8"))
    sources = all_sources(provenance)
    tools = {"numpy": np.__version__, "ffmpeg": subprocess.run(
        [args.ffmpeg, "-version"], check=True, capture_output=True, text=True
    ).stdout.splitlines()[0]}
    previous_path = args.output / "analysis.json"
    previous = json.loads(previous_path.read_text(encoding="utf-8")) if previous_path.exists() else None
    partial = set(args.roles) != set(PROFILES)
    if partial and previous is None:
        raise ValueError("--roles needs an existing analysis.json in the output directory")
    report = {
        "collection": provenance["collection"], "sampleRate": RATE,
        "format": "mono PCM16 WAV", "status": "integrated; subjective/native listening pending",
        "tools": tools, "sources": {}, "assets": {},
    }
    for source_id, source in sources.items():
        path = SOURCES / source["file"]
        if sha256(path) != source["sha256"]:
            raise ValueError(f"Source hash mismatch: {path}")
        if partial and source_id in previous["sources"] and source_id not in {
                PROFILES[role]["source"] for role in args.roles}:
            # Measured with the tools that rendered the clips that still use it.
            report["sources"][source_id] = {"tools": previous["tools"], **previous["sources"][source_id]}
        else:
            report["sources"][source_id] = {"tools": tools, "file": source["file"],
                                            **measurements(decode(args.ffmpeg, path))}
    args.output.mkdir(parents=True, exist_ok=True)
    for role, profile in PROFILES.items():
        if role not in args.roles:
            name = f"{role}.wav"
            kept = previous["assets"][name]
            if sha256(args.output / name) != kept["sha256"] or kept["profile"] != profile:
                raise ValueError(f"Kept clip does not match its analysis entry: {name}")
            report["assets"][name] = {"tools": previous["tools"], **kept}
            continue
        source = SOURCES / sources[profile["source"]]["file"]
        pcm, filters, gain = master(args.ffmpeg, source, profile)
        output = args.output / f"{role}.wav"
        with wave.open(str(output), "wb") as file:
            file.setparams((1, 2, RATE, len(pcm), "NONE", "not compressed"))
            file.writeframes(pcm.tobytes())
        decoded = decode(args.ffmpeg, output)
        metrics = measurements(decoded)
        if not (metrics["samplePeak"] <= .251
                and metrics["first20msRms"] < .01
                and metrics["lastSecondRms"] < .001
                and abs(metrics["dc"]) < 1e-5
                and decoded[0] == decoded[-1] == 0):
            raise ValueError(f"Master failed signal guards: {role}: {metrics}")
        report["assets"][output.name] = {
            "tools": tools, "sha256": sha256(output), "bytes": output.stat().st_size,
            "profile": profile, "filters": filters, "constantGain": gain,
            "measurements": metrics,
        }
        print(f"{role}: {metrics['seconds']:.2f}s, peak {metrics['samplePeak']:.4f}, "
              f"opening RMS {metrics['firstTwoSecondsRms']:.4f}")
    (args.output / "analysis.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print("Signal checks passed. These do not establish subjective quality or native playback.")


if __name__ == "__main__":
    main()
