# Split PDF into individual pages

Use pymupdf via `scripts/split-pdf.py`.

1. Ask the user for the path to the source PDF.
2. Run the script. Pages are written next to the original file as `page-1.pdf`, `page-2.pdf`, …

```bash
uv run --python .venv/bin/python skills/create-and-modify-pdf/scripts/split-pdf.py <path-to.pdf>
```
