import { defineConfig, devices } from '@playwright/test'

const enCI = Boolean(process.env.CI)

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: enCI,
  // Política de tests inestables: un reintento en CI y, si sigue fallando, cuarentena con issue.
  retries: enCI ? 1 : 0,
  reporter: enCI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.WEB_URL ?? 'http://localhost:5173',
    locale: 'es-AR',
    timezoneId: 'America/Argentina/Cordoba',
    trace: 'on-first-retry',
  },
  projects: [
    {
      // Después de cada despliegue, contra staging o producción (WEB_URL y API_URL).
      name: 'smoke',
      testDir: './tests/smoke',
      use: { ...devices['Pixel 7'] },
    },
    {
      // En cada PR, contra la app levantada en el CI (API + web + PostGIS + Mailpit).
      name: 'e2e',
      testDir: './tests/e2e',
      use: { ...devices['Pixel 7'] },
    },
  ],
})
