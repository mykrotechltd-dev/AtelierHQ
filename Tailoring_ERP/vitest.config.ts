import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Unit-test config for this app. Three projects run in one command:
//   - "convex"   backend functions, run in the edge-runtime via convex-test
//     (leftover from before this app moved onto Supabase — there is no
//     convex/ directory anymore, so this project matches nothing;
//     passWithNoTests keeps that harmless rather than a failure)
//   - "frontend" React components and logic, run in jsdom via Testing Library
//   - "supabase" SQL migrations, run in plain Node via PGlite (a real
//     Postgres engine compiled to WASM, not a mock) — loads the actual
//     cumulative supabase/schema.sql and exercises triggers/RLS against it
//
// Keep tests hermetic: use convex-test/PGlite and mocks instead of real
// deployments, network calls, or environment-dependent behavior.
export default defineConfig({
  resolve: {
    alias: {
      "@/convex": path.resolve(import.meta.dirname, "./convex"),
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  test: {
    passWithNoTests: true,
    // Restore Vitest mocks before each test to reduce state leakage.
    restoreMocks: true,
    projects: [
      {
        extends: true,
        test: {
          name: "convex",
          environment: "edge-runtime",
          include: ["convex/**/*.test.{ts,js}"],
        },
      },
      {
        extends: true,
        plugins: [react()],
        test: {
          name: "frontend",
          environment: "jsdom",
          include: ["src/**/*.test.{ts,tsx}"],
          setupFiles: ["./src/vitest.setup.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "supabase",
          environment: "node",
          include: ["supabase/**/*.test.ts"],
          // PGlite boots a real (WASM) Postgres per test file — slower
          // than a mock, but it's testing real trigger/RLS behavior, not
          // re-implementing Postgres semantics by hand to assert against.
          testTimeout: 20_000,
        },
      },
    ],
  },
});
