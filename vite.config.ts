import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { configDefaults } from "vitest/config";

export default defineConfig({
  base: "/excalidraw-animate/",
  plugins: [react()],
  build: {
    outDir: "build",
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./test/setupTests.ts"],
    exclude: [...configDefaults.exclude],
    deps: {
      interopDefault: true,
    },
    server: {
      deps: {
        fallbackCJS: true,
      },
    },
  },
});
