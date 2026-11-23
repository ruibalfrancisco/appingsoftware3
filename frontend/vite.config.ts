/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// En desarrollo (y en `vite preview`) /api se reenvía a la API local, igual que hace nginx en
// Railway: el navegador ve un solo dominio.
const proxyApi = {
  '/api': {
    // 127.0.0.1 y no localhost: Node puede resolver localhost a ::1 y uvicorn escucha en IPv4.
    target: process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:8000',
    changeOrigin: true,
    rewrite: (ruta: string) => ruta.replace(/^\/api/, ''),
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { proxy: proxyApi },
  preview: { proxy: proxyApi },
  // Un solo .env en la raíz del monorepo; Vite solo expone las variables VITE_*.
  envDir: '..',
  test: {
    environment: 'jsdom',
    env: { VITE_MAPA: 'simulado' },
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      // Los mapas de MapLibre necesitan WebGL, que jsdom no tiene: los cubren las pruebas en
      // staging. Sus reemplazos simulados (mismo contrato) sí se prueban acá.
      exclude: [
        'src/main.tsx',
        'src/test/**',
        'src/**/*.test.{ts,tsx}',
        'src/vite-env.d.ts',
        'src/reclamos/mapa/MapaOSM.tsx',
        'src/reclamos/mapa/MapaDeReclamosOSM.tsx',
        'src/reclamos/mapa/maplibre.ts',
      ],
      // RNF-10: 70 % de cobertura en el frontend; por debajo, el CI falla.
      thresholds: { lines: 70, functions: 70, branches: 70, statements: 70 },
      reporter: ['text', 'html', 'lcov'],
    },
  },
})
