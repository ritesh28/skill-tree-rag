import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/store/**/*.ts", "src/tui/**/*.ts"],
      exclude: [
        "src/store/**/*.test.ts",
        "src/store/types.ts",
        "src/tui/**/*.test.ts",
        "src/tui/types.ts",
      ],
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100,
      },
    },
  },
});
