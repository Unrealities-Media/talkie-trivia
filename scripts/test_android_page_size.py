"""Regression examples based on actual llvm-readelf output from the release APK."""
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location("page_size", Path(__file__).with_name("verify-android-page-size.py"))
page_size = importlib.util.module_from_spec(spec)
spec.loader.exec_module(page_size)


class AlignmentChecks(unittest.TestCase):
    def test_aligned_app_module(self):
        headers = """
  LOAD 0x000000 0x0000000000000000 0x0000000000000000 0x1b4970 0x1b4970 R E 0x4000
  LOAD 0x1b4970 0x00000000001b8970 0x00000000001b8970 0x00f528 0x00f690 RW  0x4000
  GNU_RELRO 0x1b4970 0x00000000001b8970 0x00000000001b8970 0x00f528 0x00f690 R 0x1
"""
        self.assertEqual(page_size.inspect_headers(headers)["problems"], [])

    def test_relro_failure_despite_aligned_load(self):
        headers = """
  LOAD 0x000000 0x0000000000000000 0x0000000000000000 0x010000 0x010000 R E 0x4000
  GNU_RELRO 0x0cfaf0 0x00000000000dfaf0 0x00000000000dfaf0 0x01510 0x01510 R 0x1
"""
        self.assertEqual(page_size.inspect_headers(headers)["problems"], ["RELRO end is not aligned to 16 KB"])

    def test_both_load_and_relro_failures_are_reported(self):
        headers = """
  LOAD 0x000000 0x0000000000000000 0x0000000000000000 0x010000 0x010000 R E 0x1000
  GNU_RELRO 0x0cfaf0 0x00000000000dfaf0 0x00000000000dfaf0 0x01510 0x01510 R 0x1
"""
        self.assertEqual(len(page_size.inspect_headers(headers)["problems"]), 2)

    def test_empty_or_changed_tool_output_cannot_pass(self):
        with self.assertRaises(ValueError):
            page_size.inspect_headers("unexpected output")

    def test_library_without_relro_can_pass_page_size_check(self):
        headers = "LOAD 0x0 0x0 0x0 0x10000 0x10000 R E 0x10000"
        self.assertEqual(page_size.inspect_headers(headers)["problems"], [])


if __name__ == "__main__":
    unittest.main()
