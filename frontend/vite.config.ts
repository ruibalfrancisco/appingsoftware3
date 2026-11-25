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

// En GitHub Actions, además de la salida de siempre: anotaciones en el código y un JUnit XML
// que el pipeline publica como informe de pruebas. En la compu quedan los reporters por defecto.
const informesDelCI =
  process.env.GITHUB_ACTIONS === 'true'
    ? {
        reporters: ['default', 'github-actions', 'junit'],
        outputFile: { junit: 'reportes/unitarias.xml' },
      }
    : {}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Sin vigilar coverage/: si no, correr la cobertura recarga las páginas abiertas (y los E2E).
  server: { proxy: proxyApi, watch: { ignored: ['**/coverage/**'] } },
  preview: { proxy: proxyApi },
  // Un solo .env en la raíz del monorepo; Vite solo expone las variables VITE_*.
  envDir: '..',
  test: {
    environment: 'jsdom',
    env: { VITE_MAPA: 'simulado' },
    setupFiles: ['./src/test/setup.ts'],
    ...informesDelCI,
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
      // json-summary: el CI arma con él la tabla de cobertura del resumen de la corrida.
      reporter: ['text', 'html', 'lcov', 'json-summary'],
    },
  },
})
