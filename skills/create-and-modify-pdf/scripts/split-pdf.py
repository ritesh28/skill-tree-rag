#!/usr/bin/env python3
"""Split a PDF into page-1.pdf, page-2.pdf, ... next to the source file."""

from __future__ import annotations

import sys
from pathlib import Path

import pymupdf as fitz


def main() -> None:
    if len(sys.argv) != 2:
        print("usage: split-pdf.py <path-to.pdf>", file=sys.stderr)
        sys.exit(1)

    source = Path(sys.argv[1]).resolve()
    if not source.is_file():
        print(f"file not found: {source}", file=sys.stderr)
        sys.exit(1)

    doc = fitz.open(source)
    out_dir = source.parent
    written: list[str] = []
    for index in range(doc.page_count):
        out = fitz.open()
        out.insert_pdf(doc, from_page=index, to_page=index)
        out_path = out_dir / f"page-{index + 1}.pdf"
        out.save(out_path)
        out.close()
        written.append(str(out_path))
    doc.close()

    for path in written:
        print(path)


if __name__ == "__main__":
    main()
