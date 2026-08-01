import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Integration suites share one PostgreSQL database; run files serially to avoid teardown races.
    fileParallelism: false,
    globals: true,
    include: ["src/**/*.spec.ts"],
  },
});
