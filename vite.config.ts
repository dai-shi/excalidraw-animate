import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { configDefaults } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'build',
  },
  ssr: {
    noExternal: ['open-color', '@excalidraw/excalidraw'],
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./test/setupTests.ts'],
    exclude: [...configDefaults.exclude],
    deps: {
      interopDefault: true,
      inline: ['open-color', '@excalidraw/excalidraw'],
    },
    server: {
      deps: {
        fallbackCJS: true,
      },
    },
  },
});
