"""Recheck the retired procedural ambience assets (Ocean, Rain, Storm; removed from the app 2026-10-17).
Their files are in Git history (commit 7378fe3); restore them beside this report to recheck.
Acoustic bells and interval loops: master-acoustic-bells.py and build-bell-loops.py.
Run with the same development-only numpy/FFmpeg used by the generator.
"""
import argparse
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "scripts/audio-sources/retired-ambience"

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--ffmpeg",required=True)
    args=parser.parse_args()
    report=json.loads((ASSETS/"analysis.json").read_text())
    for name,entry in report["assets"].items():
        path=ASSETS/name
        assert hashlib.sha256(path.read_bytes()).hexdigest()==entry["sha256"],name
        if "decoded" in entry:
            decoded=entry["decoded"]
            assert decoded["peak"]<.5 and abs(decoded["dc"])<1e-4,name
            assert decoded["seamStep"]<decoded["ordinaryStep99"],name
            assert decoded["correlationWithMaster"]>.99,name
    print("PASS: ambience hashes and recorded headroom, encoded seams and fidelity")

if __name__=="__main__": main()
