"""APK verifier fixtures for ELF alignment and current offline audio (stdlib only)."""
import importlib.util
from pathlib import Path
import re
import struct
import unittest

spec = importlib.util.spec_from_file_location("apk_verifier", Path(__file__).with_name("verify-android-apk.py"))
verifier = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verifier)


def library(bits=64, alignment=16384, address=0, offset=0, kind=1):
    header, program = (64, 56) if bits == 64 else (52, 32)
    data = bytearray(header + program)
    data[:7] = b"\x7fELF" + bytes([2 if bits == 64 else 1, 1, 1])
    if bits == 64:
        struct.pack_into("<Q", data, 32, header)
        struct.pack_into("<HH", data, 54, program, 1)
        struct.pack_into("<IIQQQQQQ", data, header, kind, 5, offset, address, 0, 0, 0, alignment)
    else:
        struct.pack_into("<I", data, 28, header)
        struct.pack_into("<HH", data, 42, program, 1)
        struct.pack_into("<IIIIIIII", data, header, kind, offset, address, 0, 0, 0, 5, alignment)
    return data


class ElfCompatibility(unittest.TestCase):
    def test_supported_classes_and_larger_alignment(self):
        for bits in (32, 64):
            for alignment in (16384, 65536):
                self.assertEqual(verifier.elf_load_alignment(library(bits, alignment)), [alignment])

    def test_small_or_non_power_of_two_alignment_rejected(self):
        for alignment in (0, 4096, 24576):
            with self.assertRaises(ValueError):
                verifier.elf_load_alignment(library(alignment=alignment))

    def test_incongruent_address_and_file_offset_rejected(self):
        with self.assertRaises(ValueError):
            verifier.elf_load_alignment(library(address=4096))

    def test_truncated_header_or_table_rejected(self):
        for size in (0, 16, 63, 64, 119):
            with self.assertRaises(ValueError):
                verifier.elf_load_alignment(library()[:size])

    def test_invalid_format_rejected(self):
        for position, value in ((0, 0), (4, 3), (5, 2), (6, 0)):
            data = library()
            data[position] = value
            with self.assertRaises(ValueError):
                verifier.elf_load_alignment(data)

    def test_missing_or_extended_program_table_rejected(self):
        for count in (0, 0xffff):
            data = library()
            struct.pack_into("<H", data, 56, count)
            with self.assertRaises(ValueError):
                verifier.elf_load_alignment(data)

    def test_no_loadable_segments_rejected(self):
        with self.assertRaises(ValueError):
            verifier.elf_load_alignment(library(kind=2))


class OfflineAudio(unittest.TestCase):
    def test_verifier_covers_the_current_runtime_catalogue(self):
        catalogue = (verifier.ROOT / "src/audio/assets.ts").read_text(encoding="utf-8")
        bundled = set(re.findall(r"require\(['\"]\.\./\.\./assets/audio/([^'\"]+\.(?:wav|m4a|flac))['\"]\)", catalogue))
        self.assertTrue(bundled, "The runtime catalogue must contain bundled audio")
        targets = verifier.expected_audio_hashes()
        self.assertEqual(set(targets.values()), bundled)
        for sha256, name in targets.items():
            self.assertEqual(verifier.digest((verifier.ROOT / "assets/audio" / name).read_bytes()), sha256)


if __name__ == "__main__":
    unittest.main()
