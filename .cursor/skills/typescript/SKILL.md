---
name: typescript
description: >-
  Write and refactor TypeScript for this Node ESM project using classes,
  minimal exports, Zod validation, Vitest, and strict tsconfig rules. Use when
  creating or editing .ts files, adding modules under src/, writing tests, or
  when the user asks about TypeScript style, classes vs functions, or exports.
---

# TypeScript

Conventions for **skill-tree-rag** TypeScript (Node 20+, ESM, strict).

## Defaults

- Prefer **classes** over standalone functions for behavior (loaders, checks, parsers, runners, stores).
- Keep helpers as **private methods** or module-private (no `export`) symbols.
- Use the `export` keyword **only** for symbols other modules actually import.
- Do not re-export transitive APIs “for convenience” unless something imports them.
- Prefer `import type` for type-only imports.
- Use `.js` extensions in relative imports (`./foo.js`) — `module`/`moduleResolution` are `NodeNext`.
- After substantive TS changes, run `npm run typecheck`.
- After behavior changes under `src/`, run `npm run test:coverage` (or at least `npm test`).

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

## Testing (Vitest)

- Use **Vitest** only (`*.test.ts` next to the unit under test, e.g. `sessionStore.test.ts`).
- Import from `vitest` (`describe` / `it` / `expect`) — do not rely on globals.
- Do **not** add one-off smoke scripts; cover behavior with tests.
- Aim for **100% coverage** on new/changed runtime modules (`npm run test:coverage`).
- Type-only files (e.g. `types.ts`) are excluded from coverage thresholds.
- `*.test.ts` files are excluded from `tsc` (`tsconfig` exclude).

```bash
npm test
npm run test:coverage
```

## Project layout hints

| Area | Where |
| --- | --- |
| App / tooling code | `src/**` |
| Skill authoring (not TS runtime) | `skills/**` |
| Generated skill registry | `src/generated/skills.ts` — do not hand-edit; run `npm run skill-sync` |
| System prompt | `src/agent/system-prompt.md` |

## Checklist before finishing TS work

- [ ] Behavior lives on classes; internals are private or unexported
- [ ] No unused exports
- [ ] Relative imports use `.js` suffix
- [ ] `npm run typecheck` passes
- [ ] `npm run test:coverage` passes for touched runtime code
- [ ] If skills on disk changed: run structure / reference / frontmatter checks + sync as needed
