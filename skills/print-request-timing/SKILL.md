---
name: Print Request Timing
description: Always report how long a request or tool step took to process
metadata:
  attachtype: always
  version: "0.1.0"
---

# Print Request Timing

The TUI shows a **thinking** spinner while the model works, then prints thought duration after each turn (model time only; tool waits are excluded).

- Do **not** invent or print your own duration lines (e.g. “Request Duration: …”).
- Rely on the TUI’s `thought …` line (shown when initial thinking finishes, and again after analyzing your answers).
- Durations: under `0.5s` → `briefly`; otherwise whole seconds rounded **up** (`1s`, `2s`, …).
