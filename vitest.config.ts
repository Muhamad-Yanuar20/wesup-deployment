import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";

const env = loadEnv("", process.cwd(), "");

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    env,
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
