---
name: Print Request Timing
description: Always report how long a request or tool step took to process
metadata:
  attachtype: always
  version: "0.1.0"
---

# Print Request Timing

For every user request you process, report the time taken.

- Report durations in whole **seconds** only (no decimals):
  - under `0.5s` → `~0s`
  - otherwise round **up** to the next whole second (`1s`, `2s`, …)
- Include timing for overall request handling and for individual tool/script runs when available.
- Print timing clearly in the TUI so the user can see it without asking.
