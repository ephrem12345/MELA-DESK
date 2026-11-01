import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/policies/tickets.ts", "src/modules/auth/schemas.ts", "src/modules/tickets/schemas.ts", "src/services/localization.ts", "src/services/sla-calculator.ts"],
      thresholds: { lines: 80, functions: 80, branches: 75, statements: 80 },
    },
  },
});
