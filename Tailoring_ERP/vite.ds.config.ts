import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";

// Library build of the UI kit (src/ds/index.ts), consumed by /design-sync -
// separate from the app build (vite.config.ts) so neither touches the other:
// this one writes dist-ds/, the app writes dist/.
//
// Bare package imports (react, radix-ui, lucide-react, ...) stay external:
// the design-sync converter re-bundles from node_modules and shims React onto
// the design environment's own copy. Only the "@/..." alias is inlined here.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  publicDir: false,
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "./src") },
    dedupe: ["react", "react-dom", "react/jsx-runtime"],
  },
  build: {
    outDir: "dist-ds",
    emptyOutDir: true,
    minify: false,
    cssCodeSplit: false,
    lib: {
      entry: path.resolve(import.meta.dirname, "src/ds/index.ts"),
      formats: ["es"],
      fileName: () => "index.es.js",
      cssFileName: "style",
    },
    rollupOptions: {
      external: (id: string) =>
        !id.startsWith(".") && !id.startsWith("@/") && !path.isAbsolute(id),
    },
  },
});
