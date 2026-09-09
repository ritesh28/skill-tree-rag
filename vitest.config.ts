import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: [
        "src/store/**/*.ts",
        "src/tui/**/*.ts",
        "src/scripts/**/*.ts",
        "src/tools/**/*.ts",
        "src/agent/**/*.ts",
      ],
      exclude: [
        "src/store/**/*.test.ts",
        "src/store/types.ts",
        "src/tui/**/*.test.ts",
        "src/tui/types.ts",
        "src/scripts/**/*.test.ts",
        "src/scripts/types.ts",
        "src/tools/**/*.test.ts",
        "src/agent/**/*.test.ts",
        "src/agent/system-prompt.md",
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 90,
        statements: 90,
      },
    },
  },
});
