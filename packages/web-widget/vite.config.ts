import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: "src/csbot-widget.ts",
      formats: ["es"],
      fileName: "csbot-widget",
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
    minify: true,
    sourcemap: true,
  },
  server: {
    port: 5173,
  },
});
