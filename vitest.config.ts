import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["./vitest.setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
