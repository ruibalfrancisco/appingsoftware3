import { defineConfig, devices } from '@playwright/test'

const enCI = Boolean(process.env.CI)

// Cada corrida del pipeline le pone nombre a su informe (e2e, smoke-staging, integracion-qa...)
// para que dos corridas en el mismo job no se pisen.
const informe = process.env.INFORME ?? 'playwright'

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: enCI,
  // Política de tests inestables: un reintento en CI y, si sigue fallando, cuarentena con issue.
  retries: enCI ? 1 : 0,
  // En CI: anotaciones en GitHub, informe HTML (se guarda como artefacto) y JUnit XML (se
  // publica como informe de pruebas en la corrida).
  reporter: enCI
    ? [
        ['github'],
        ['html', { open: 'never', outputFolder: `playwright-report/${informe}` }],
        ['junit', { outputFile: `reportes/${informe}.xml` }],
      ]
    : 'list',
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
    {
      // Después de desplegar en QA (staging): pruebas de integración contra la web, la API, la
      // base y el bucket de ese ambiente. Nunca contra producción: cargan datos de prueba.
      name: 'qa',
      testDir: './tests/qa',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
