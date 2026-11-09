import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

const alias = { "@": fileURLToPath(new URL("./src", import.meta.url)) };

export default defineConfig(({ mode }) => ({
  resolve: { alias },
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: "unit",
          include: ["src/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        resolve: { alias },
        test: {
          // Runs against the local Supabase stack (`npm run db:start` + `npm run db:reset`).
          name: "db",
          include: ["tests/db/**/*.test.ts"],
          environment: "node",
          env: loadEnv(mode, process.cwd(), ""),
          testTimeout: 30_000,
          // Tests share one database, so files run one after another.
          fileParallelism: false,
        },
      },
    ],
  },
}));
