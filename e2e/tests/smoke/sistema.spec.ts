import { expect, test } from '@playwright/test'

const API_URL = (process.env.API_URL ?? 'http://localhost:8000').replace(/\/$/, '')
// El pipeline pasa el commit que acaba de desplegar para confirmar que no quedó la versión vieja.
const COMMIT_ESPERADO = process.env.EXPECTED_COMMIT

test('la API responde /health con la versión desplegada', async ({ request }) => {
  const respuesta = await request.get(`${API_URL}/health`)

  expect(respuesta.ok()).toBeTruthy()
  const salud = await respuesta.json()
  expect(salud.status).toBe('ok')
  if (COMMIT_ESPERADO) {
    expect(salud.commit).toBe(COMMIT_ESPERADO)
  }
})

test('la web reenvía /api a la API por la red privada', async ({ request }) => {
  const respuesta = await request.get('/api/health')

  expect(respuesta.ok()).toBeTruthy()
  expect((await respuesta.json()).status).toBe('ok')
})

test('la web carga y se conecta con la API', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { level: 1, name: 'Reclamos Villa Allende' })).toBeVisible()
  await expect(page.getByText('API conectada')).toBeVisible()
})
