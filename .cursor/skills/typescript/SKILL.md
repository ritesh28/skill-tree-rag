---
name: typescript
description: >-
  Write and refactor TypeScript for this Node ESM project using classes,
  minimal exports, Zod validation, and strict tsconfig rules. Use when
  creating or editing .ts files, adding modules under src/, or when the user
  asks about TypeScript style, classes vs functions, or exports.
---

# TypeScript

Conventions for **skill-tree-rag** TypeScript (Node 20+, ESM, strict).

## Defaults

- Prefer **classes** over standalone functions for behavior (loaders, checks, parsers, runners).
- Keep helpers as **private methods** or module-private (no `export`) symbols.
- Use the `export` keyword **only** for symbols other modules actually import.
- Do not re-export transitive APIs “for convenience” unless something imports them.
- Prefer `import type` for type-only imports.
- Use `.js` extensions in relative imports (`./foo.js`) — `module`/`moduleResolution` are `NodeNext`.
- After substantive TS changes, run `npm run typecheck`.

## Module shape

```ts
// Good: export the class; keep schema/helpers private
const schema = z.object({ /* ... */ });

export class ThingParser {
  parse(input: string): Result {
    // ...
  }

  private formatError(error: z.ZodError): string {
    // ...
  }
}
```

```ts
// Bad: export everything; prefer free functions for core behavior
export function parseThing() {}
export function formatError() {}
export const schema = z.object({});
```

## Types

- Put shared domain types in focused `types.ts` (or next to the owning class).
- Derive types from Zod with `z.output<typeof schema>` when a schema is the source of truth.
- Avoid `any`. Prefer `unknown` + narrowing at boundaries (CLI args, file I/O, YAML/`gray-matter` data).

## Validation

- Validate external/authoring input (frontmatter, config) with **Zod v4** (`import { z } from "zod"`).
- Parse markdown frontmatter with **gray-matter**, then `schema.safeParse(...)`.
- Surface validation failures as clear, path-qualified messages (skill id / field path).

## Project layout hints

| Area | Where |
| --- | --- |
| App / tooling code | `src/**` |
| Skill authoring (not TS runtime) | `skills/**` |
| Generated skill registry | `src/generated/skills.ts` — do not hand-edit; run `npm run skill-sync` |

## Checklist before finishing TS work

- [ ] Behavior lives on classes; internals are private or unexported
- [ ] No unused exports
- [ ] Relative imports use `.js` suffix
- [ ] `npm run typecheck` passes
- [ ] If skills on disk changed: run structure / reference / frontmatter checks + sync as needed
