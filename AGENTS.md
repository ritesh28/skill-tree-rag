# AGENTS.md

Guidance for coding agents working on **skill-tree-rag**.

Product intent and longer rationale live in `.scratch/ideasV2.md`. Prefer this file for day-to-day conventions.

## What this project is

A Node.js + TypeScript TUI chatbot (Vercel AI SDK, `@clack/prompts`) where **skills are first-class tools**. Skills live as markdown trees on disk; `skill-sync` generates TypeScript objects used for tool calling.

**v1 principles**

- In-memory session state only (no DB)
- Skills = knowledge / instructions; scripts = actions
- Prefer clear TUI feedback (reasoning, tool calls, timings, human interrupt / ask)

## Repo layout

```
src/           # app: cli, agent, tools, store, script runner
src/generated/ # skill-sync output (skills.ts)
skills/        # author-facing skill tree (do not invent alternate layouts)
.scratch/      # notes / ideas — not runtime
```

## Skills (authoring rules)

Each skill is a **folder** under `skills/`:

```
skills/<skill-name>/
  SKILL.md           # required
  subskills/         # optional, flat .md only
  scripts/           # optional, flat .ts | .js | .py only
```

### Hard rules

- Every skill folder **must** have `SKILL.md`.
- `subskills/` and `scripts/` are **flat** (no nested directories).
- Do **not** list subskills/scripts in frontmatter; reference them as `subskills/[name]` and `scripts/[name]` in `SKILL.md` and/or subskill bodies.
- Unfinished files: name them `*.TODO.<ext>` (e.g. `draft.TODO.md`, `explore.TODO.py`). They are exempt from reference coverage.
- After changing skills, run `skill-structure-check`, `skill-reference-check`, `skill-frontmatter-check`, and `skill-sync` as needed. These also run on **pre-commit**.

### `SKILL.md` frontmatter

Required:

```yaml
---
name: Example Skill
description: One-line tool description
metadata:
  attachtype: on-demand # always | on-demand
  version: "0.1.0" # recommended
  allowedTools: [] # recommended
---
```

| Field                   | Required                      |
| ----------------------- | ----------------------------- |
| `name`                  | yes                           |
| `description`           | yes                           |
| `metadata.attachtype`   | yes (`always` \| `on-demand`) |
| `metadata.version`      | recommended                   |
| `metadata.allowedTools` | recommended                   |

No `license` field. No `scripts:` / `subskills:` frontmatter lists.

### Reference coverage

- Scanned sources: `SKILL.md` **+** all files in `subskills/`.
- Every non-`TODO` file in `subskills/` and `scripts/` must appear as `subskills/[name]` or `scripts/[name]` in those sources.
- Do **not** enforce reference delimiter markup.
- Do **not** fail on dangling references (mentioned name with no file).

## Package scripts

| Script                    | Role                                                |
| ------------------------- | --------------------------------------------------- |
| `skill-sync`              | Generate `src/generated/skills.ts` for tool calling |
| `skill-structure-check`   | Validate skill folder layout                        |
| `skill-reference-check`   | Validate subskill/script reference coverage         |
| `skill-frontmatter-check` | Validate `SKILL.md` frontmatter with Zod            |
| `dev`                     | Local development                                   |
| `start`                   | App entry                                           |

Do not hand-edit `src/generated/skills.ts`; change skills on disk and re-sync.

### Generated skill shape (target)

`SkillDefinition`: `id` (folder name), `name`, `description`, `metadata`, `content`, `subskills[]` (`path` like `subskills/greet.md` + `content`), `scripts[]` (`path` like `scripts/shout.ts` + `language` + `content`).  
Also export `skills`, `skillsById`, `alwaysAttachedSkills`.  
`*.TODO.*` files are **omitted** from the generated registry (authoring-only; not for the agent).

## App / agent conventions

### Stack

- Node.js, TypeScript
- Vercel AI SDK for streaming + tools
- `@clack/prompts` for CLI prompts
- Credentials: runtime prompt and/or env — **never commit secrets**

### Providers (curated list)

OpenAI, Anthropic, Google (Gemini), Groq, Mistral, DeepSeek, OpenRouter, Ollama (local), Azure OpenAI.

### MVP tool surface

Required UX: reasoning display, tool-call display, human interrupt, ask question, timings.

Skill-facing tools to prioritize: `list_skills`, `get_skill`, `run_script` (plus the UX tools above).

### Out of scope for v1

Persistent history, embeddings DB / full RAG index, multi-user server, heavy full-screen TUI unless clearly needed.

## Working in this repo

1. Prefer implementing against decided rules in this file and `.scratch/ideasV2.md`.
2. When editing under `skills/`, keep structure/reference rules; run the skill check scripts.
3. Do not invent alternate skill discovery mechanisms (e.g. frontmatter script lists).
4. Ask before expanding MVP scope into “Out of scope for v1” items.
