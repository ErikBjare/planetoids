import { defineConfig } from "vite";
import { resolve } from "path";

// Get the base path from environment variable
const basePath = process.env.BASE_PATH || "/";
console.log("Using base path:", basePath);

export default defineConfig({
  base: basePath,
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
  server: {
    open: true,
  },
});
