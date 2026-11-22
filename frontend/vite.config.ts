/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Un solo .env en la raíz del monorepo; Vite solo expone las variables VITE_*.
  envDir: '..',
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/main.tsx', 'src/test/**', 'src/**/*.test.{ts,tsx}', 'src/vite-env.d.ts'],
      // RNF-10: 70 % de cobertura en el frontend; por debajo, el CI falla.
      thresholds: { lines: 70, functions: 70, branches: 70, statements: 70 },
      reporter: ['text', 'html', 'lcov'],
    },
  },
})
