import { expect, test } from '@playwright/test'
import { FOTO, reclamarPorApi, vecinoConSesion } from './vecino'

// La crea el CI con `python -m app.municipales` (ver ci.yml); en local, la misma línea del README.
const OPERADORA = {
  dni: process.env.OPERADOR_DNI ?? '20999888',
  clave: process.env.OPERADOR_CLAVE ?? 'clave-de-prueba-1',
}

test('E2E-04 la operadora resuelve un reclamo y el vecino ve el resultado (CU-07, CU-08)', async ({
  page,
  request,
  browser,
  baseURL,
}) => {
  // Un vecino (en su celular) carga un bache; por la API para ir al grano.
  await vecinoConSesion(page, request)
  const numero = await reclamarPorApi(page.request, {
    latitud: -31.2945,
    longitud: -64.2955,
    gravedad: 6,
    descripcion: 'Bache frente a la escuela',
  })

  // La operadora, en una compu: ingresa y el sistema la lleva al Tablero (CU-03).
  const compu = await browser.newContext({
    baseURL,
    viewport: { width: 1280, height: 800 },
    locale: 'es-AR',
    timezoneId: 'America/Argentina/Cordoba',
  })
  const operadora = await compu.newPage()
  await operadora.goto('/ingresar')
  await operadora.getByLabel('DNI o email').fill(OPERADORA.dni)
  await operadora.getByLabel('Contraseña', { exact: true }).fill(OPERADORA.clave)
  await operadora.getByRole('button', { name: 'Ingresar' }).click()
  await expect(operadora).toHaveURL(/\/tablero$/)

  // CU-07: lo encuentra en la cola priorizada y abre el detalle.
  await operadora
    .getByRole('list', { name: 'Reclamos por prioridad' })
    .getByRole('link')
    .filter({ hasText: new RegExp(`#${numero}(?!\\d)`) })
    .click()
  await expect(operadora.getByRole('heading', { name: `Bache #${numero}` })).toBeVisible()

  // CU-08: Pendiente → En revisión → En proceso (con área) → Resuelto (con foto del después).
  await operadora.getByRole('button', { name: 'Pasar a En revisión' }).click()
  await operadora.getByRole('button', { name: 'Confirmar: Pasar a En revisión' }).click()
  await expect(operadora.getByText(/pasó a En revisión/)).toBeVisible()

  await operadora.getByRole('button', { name: 'Pasar a En proceso' }).click()
  await operadora.getByLabel('Área responsable').selectOption({ label: 'Obras Públicas' })
  await operadora.getByRole('button', { name: 'Confirmar: Pasar a En proceso' }).click()
  await expect(operadora.getByText(/pasó a En proceso/)).toBeVisible()

  await operadora.getByRole('button', { name: 'Resolver' }).click()
  await operadora.getByLabel('Qué se hizo').fill('Bacheado y señalizado')
  await operadora.getByLabel(/Elegir la foto del después/).setInputFiles(FOTO)
  await expect(operadora.getByRole('img', { name: 'Foto del después' })).toBeVisible()
  await operadora.getByRole('button', { name: 'Confirmar: Resolver' }).click()
  // RN-07: la novedad es para el vecino que lo cargó.
  await expect(operadora.getByText(/pasó a Resuelto\. Le avisamos a 1 vecino\./)).toBeVisible({
    timeout: 15_000,
  })
  await expect(operadora.getByRole('region', { name: 'Historial' })).toContainText(
    'Olga Operadora',
  )
  await compu.close()

  // El vecino ve el resultado con el comentario y la foto del después (RF-22).
  await page.goto(`/reclamos/${numero}`)
  await expect(page.getByText('Resuelto', { exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Seguimiento' })).toContainText(
    'Bacheado y señalizado',
  )
  const despues = page.getByRole('img', { name: /Así quedó/ })
  await expect(despues).toBeVisible()
  // La foto viene del bucket con URL firmada y reducida a 1600 px: tiene que cargar de verdad.
  await expect.poll(() => despues.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(1600)
})

test('un vecino que entra a /tablero ve que es solo para personal municipal', async ({
  page,
  request,
}) => {
  await vecinoConSesion(page, request)

  await page.goto('/tablero')

  await expect(page.getByRole('heading', { name: 'Solo personal municipal' })).toBeVisible()
})
