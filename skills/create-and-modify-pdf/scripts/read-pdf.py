#!/usr/bin/env python3
"""Extract text from a PDF with pymupdf and print to stdout."""

from __future__ import annotations

import sys
from pathlib import Path

import pymupdf as fitz


def main() -> None:
    if len(sys.argv) != 2:
        print("usage: read-pdf.py <path-to.pdf>", file=sys.stderr)
        sys.exit(1)

    source = Path(sys.argv[1]).resolve()
    if not source.is_file():
        print(f"file not found: {source}", file=sys.stderr)
        sys.exit(1)

    doc = fitz.open(source)
    parts: list[str] = []
    for page in doc:
        parts.append(page.get_text())
    doc.close()
    print("".join(parts), end="")


if __name__ == "__main__":
    main()
