"""Inspect a preview APK without installing it or reading private signing material.

Requires standard Python and Android build-tools. Verify against current app identity
and runtime audio hashes; keep the resulting report beside the ignored artifact.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import struct
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]


def run(command):
    return subprocess.run([str(value) for value in command], check=True,
                          capture_output=True, text=True).stdout


def digest(data):
    return hashlib.sha256(data).hexdigest()


def elf_load_alignment(data):
    """Return PT_LOAD alignments; reject malformed ELF instead of claiming a pass."""
    if len(data) < 16 or data[:4] != b"\x7fELF" or data[5] != 1 or data[6] != 1:
        raise ValueError("Expected a little-endian ELF version 1 library")
    if data[4] == 2:
        header_size, table_offset, entry_size, count_offset = 64, 32, 54, 56
        offset_format, program_size, program_format = "<Q", 56, "<IIQQQQQQ"
    elif data[4] == 1:
        header_size, table_offset, entry_size, count_offset = 52, 28, 42, 44
        offset_format, program_size, program_format = "<I", 32, "<IIIIIIII"
    else:
        raise ValueError("Unsupported ELF class")
    if len(data) < header_size:
        raise ValueError("Truncated ELF header")
    start = struct.unpack_from(offset_format, data, table_offset)[0]
    stride = struct.unpack_from("<H", data, entry_size)[0]
    count = struct.unpack_from("<H", data, count_offset)[0]
    if not count or count == 0xffff or stride < program_size or start < header_size or start + count * stride > len(data):
        raise ValueError("Invalid or unsupported ELF program table")
    alignments = []
    for index in range(count):
        fields = struct.unpack_from(program_format, data, start + index * stride)
        if fields[0] != 1:  # PT_LOAD
            continue
        offset, address = fields[2:4] if data[4] == 2 else fields[1:3]
        alignment = fields[-1]
        if alignment < 16384 or alignment & (alignment - 1) or (offset - address) % alignment:
            raise ValueError(f"PT_LOAD segment is not 16 KB compatible (alignment={alignment})")
        alignments.append(alignment)
    if not alignments:
        raise ValueError("ELF library has no loadable segments")
    return alignments


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("apk", type=Path)
    parser.add_argument("--java", type=Path, required=True)
    parser.add_argument("--build-tools", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    args = parser.parse_args()
    apk = args.apk.resolve(strict=True)
    config = json.loads((ROOT / "app.json").read_text(encoding="utf-8"))["expo"]
    tools = args.build_tools
    executable_suffix = ".exe" if os.name == "nt" else ""
    signature = run([args.java, "-jar", tools / "lib/apksigner.jar",
                     "verify", "--verbose", "--print-certs", apk])
    badging = run([tools / f"aapt2{executable_suffix}", "dump", "badging", apk])
    manifest = run([tools / f"aapt2{executable_suffix}", "dump", "xmltree", apk, "--file", "AndroidManifest.xml"])
    run([tools / f"zipalign{executable_suffix}", "-c", "-P", "16", "4", apk])
    package = re.search(r"package: name='([^']+)' versionCode='([^']+)' versionName='([^']+)'", badging)
    if not package or package.groups() != (config["android"]["package"],
                                          str(config["android"]["versionCode"]), config["version"]):
        raise ValueError("APK identity/version does not match the current app configuration")
    if "application-debuggable" in badging:
        raise ValueError("Expected a standalone release APK, not a debuggable development build")
    if "android.permission.RECORD_AUDIO" in badging:
        raise ValueError("Ona must not request microphone recording")
    for permission in ("android.permission.FOREGROUND_SERVICE", "android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK"):
        if permission not in badging:
            raise ValueError(f"Missing native background audio configuration: {permission}")
    certificate = re.search(r"Signer #1 certificate SHA-256 digest: ([0-9a-f]+)", signature)
    if not certificate:
        raise ValueError("Missing verified signing certificate")
    minimum_sdk = re.search(r"(?:minSdkVersion|sdkVersion):'([0-9]+)'", badging)
    target_sdk = re.search(r"targetSdkVersion:'([0-9]+)'", badging)
    if not minimum_sdk or not target_sdk:
        raise ValueError("Missing numeric minimum/target Android SDK metadata")

    targets = {}
    for folder, report in [("meditation", "analysis.json"), ("bells-v2", "analysis.json"), ("bells-v2", "timelines.json")]:
        audio = json.loads((ROOT / "assets/audio" / folder / report).read_text(encoding="utf-8"))
        for name, entry in audio["assets"].items():
            targets[entry["sha256"]] = f"{folder}/{name}"
    choir = ROOT / "assets/audio/meditation-choir.wav"
    targets[digest(choir.read_bytes())] = "meditation-choir.wav"
    found = {}
    native_alignment = {}
    with zipfile.ZipFile(apk) as archive:
        names = archive.namelist()
        if "assets/index.android.bundle" not in names:
            raise ValueError("No bundled JavaScript/Hermes entry: the app must run without Metro")
        payload = archive.read("assets/index.android.bundle")
        # Hermes bytecode magic, rather than a JS stub or a development-server URL.
        if payload[:8] != bytes.fromhex("c61fbc03c103191f"):
            raise ValueError("Expected the bundled Hermes bytecode payload")
        if not any(name.startswith("lib/arm64-v8a/") and name.endswith(".so") for name in names):
            raise ValueError("No native arm64 Android libraries")
        for name in names:
            # Android's 16 KB compatibility requirement concerns the 64-bit ABIs.
            if name.startswith(("lib/arm64-v8a/", "lib/x86_64/")) and name.endswith(".so"):
                try:
                    native_alignment[name] = elf_load_alignment(archive.read(name))
                except ValueError as error:
                    raise ValueError(f"{name}: {error}") from error
            if name.lower().endswith((".wav", ".m4a", ".flac")):
                actual = digest(archive.read(name))
                if actual in targets:
                    found[targets[actual]] = name
        if set(found) != set(targets.values()):
            raise ValueError(f"Missing or changed offline audio: {sorted(set(targets.values()) - set(found))}")
    result = {
        "apk": apk.name, "bytes": apk.stat().st_size, "sha256": digest(apk.read_bytes()),
        "package": package.group(1), "versionCode": int(package.group(2)), "version": package.group(3),
        "signerCertificateSha256": certificate.group(1), "signatureVerification": signature.splitlines(),
        "sdk": minimum_sdk.group(1),
        "targetSdk": target_sdk.group(1),
        "release": True, "zipAlignment": "verified (including 16 KB native ZIP alignment)",
        "bundledHermes": True, "offlineAudio": found,
        "native64BitElfLoadAlignments": native_alignment,
        "nativeRuntimeTested": False,
    }
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    args.report.with_suffix(".manifest.txt").write_text(manifest, encoding="utf-8")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
