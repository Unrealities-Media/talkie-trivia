"""Inspect the actual APK with Android's ZIP, LOAD and RELRO alignment checks.

Requires Python 3 and the Android SDK/NDK tools supplied on the command line.
This is a binary gate, not a substitute for installing on a 16 KB device.
"""

import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess
import tempfile
from zipfile import ZipFile

PAGE_SIZE = 16384


def run(command):
    result = subprocess.run(command, capture_output=True, text=True, check=False)
    if result.returncode:
        raise RuntimeError(f"{Path(command[0]).name} failed: {result.stderr or result.stdout}")
    return result.stdout


def inspect_headers(headers):
    loads = []
    relro_ends = []
    for line in headers.splitlines():
        fields = line.split()
        if fields and fields[0] == "LOAD":
            loads.append(int(fields[-1], 16))
        elif fields and fields[0] == "GNU_RELRO":
            relro_ends.append(int(fields[2], 16) + int(fields[5], 16))
    if not loads:
        raise ValueError("No LOAD segments found; verify llvm-readelf output format")
    problems = []
    if any(value < PAGE_SIZE for value in loads):
        problems.append("LOAD alignment is below 16 KB")
    if any(value % PAGE_SIZE for value in relro_ends):
        problems.append("RELRO end is not aligned to 16 KB")
    return {"loadAlignments": loads, "relroEnds": relro_ends, "problems": problems}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("apk", type=Path)
    parser.add_argument("--readelf", required=True, type=Path)
    parser.add_argument("--zipalign", required=True, type=Path)
    parser.add_argument("--report", required=True, type=Path)
    args = parser.parse_args()
    for file in [args.apk, args.readelf, args.zipalign]:
        if not file.is_file():
            parser.error(f"Required file is missing: {file}")
    report = {
        "artifact": args.apk.name,
        "sha256": hashlib.sha256(args.apk.read_bytes()).hexdigest(),
        "bytes": args.apk.stat().st_size,
        "zipAligned": False,
        "libraries": [],
        "errors": [],
    }
    try:
        run([str(args.zipalign.resolve()), "-c", "-P", "16", "4", str(args.apk.resolve())])
        report["zipAligned"] = True
    except RuntimeError as error:
        report["errors"].append(str(error))
    # Only 64-bit ABIs need this page-size check. Never extract paths from an
    # archive directly: write each selected library to a fixed temporary name.
    with ZipFile(args.apk) as archive, tempfile.TemporaryDirectory(prefix="talkie-elf-") as temporary:
        libraries = [name for name in archive.namelist()
                     if re.fullmatch(r"lib/(arm64-v8a|x86_64)/[^/]+\.so", name)]
        if not libraries:
            report["errors"].append("No ARM64/x86_64 shared libraries found in the APK")
        for name in libraries:
            file = Path(temporary) / "library.so"
            file.write_bytes(archive.read(name))
            try:
                headers = run([str(args.readelf.resolve()), "-lW", str(file)])
                inspection = inspect_headers(headers)
            except (RuntimeError, ValueError, IndexError) as error:
                inspection = {"problems": [str(error)]}
            report["libraries"].append({"file": name, **inspection})
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    failures = [lib for lib in report["libraries"] if lib["problems"]]
    print(f"ZIP aligned: {report['zipAligned']}; libraries checked: {len(report['libraries'])}; failures: {len(failures)}")
    for error in report["errors"]:
        print(error)
    for lib in failures:
        print(f"{lib['file']}: {', '.join(lib['problems'])}")
    return 1 if report["errors"] or failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
