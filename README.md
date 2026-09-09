# skill-tree-rag

Terminal chatbot where **skills** (markdown trees) are first-class tools. Skills live under `skills/`; `skill-sync` generates `src/generated/skills.ts` for tool calling.

## Requirements

- Node.js 20+
- Optional: provider API key(s) (see `.env.example`) or Ollama locally
- Optional: Python 3.11+ and [uv](https://docs.astral.sh/uv/) for skill scripts that use Python (e.g. PDF create/split/read via pymupdf)

## Setup

### Node

```bash
npm install
npm run skill-sync
```

`npm install` also enables the Husky pre-commit hook (`prepare`).

### Python (for `.py` skill scripts)

Create a repo-root `.venv` and install deps from `pyproject.toml` / `uv.lock` (pymupdf, etc.):

```bash
# Install uv if needed: https://docs.astral.sh/uv/getting-started/installation/
uv sync
```

The script runner prefers `.venv/bin/python` when present; otherwise it falls back to `python3` on your PATH.

Verify:

```bash
uv run python -c "import pymupdf; print('ok')"
```

## Run

```bash
npm run dev
```

You will be prompted for provider / credentials / model (env vars and `~/.config/skill-tree-rag/config.json` are preferred when set). Then chat in the TUI.

- **Ctrl+C** during a reply interrupts generation
- **`/exit`** or **`/quit`** leaves the chat
- `ask_question` tool can pause for a batch of A/B (or A/B + free-form C) questions

## Skill checks

```bash
npm run skill-structure-check
npm run skill-reference-check
npm run skill-frontmatter-check
npm run skill-sync
# or all of the above:
npm run precommit
```

Pre-commit runs `precommit` and stages `src/generated/skills.ts` if sync rewrote it.

## Smoke checklist (manual)

1. Fresh clone → Node setup (`npm install` → `npm run skill-sync`) → optional Python setup (`uv sync`) → `npm run dev`
2. Complete provider setup (or use env vars) and send a short message; streamed text appears
3. Ask something that loads an on-demand skill (e.g. zip lookup) and confirm tool calls print
4. (Optional) Ask to create/split/read a PDF with the Python path; confirm `.venv` scripts run
5. Trigger a clarifying question path; confirm the prompt pauses and resumes
6. Press Ctrl+C mid-reply; confirm interrupt messaging
7. Intentionally break a skill (e.g. remove a `SKILL.md` or add an unreferenced `subskills/foo.md`) and `git commit` — pre-commit should fail; restore and commit succeeds with sync

## Docs for agents

See `AGENTS.md` for skill layout and conventions. Longer product notes live in `.scratch/` (local only).
