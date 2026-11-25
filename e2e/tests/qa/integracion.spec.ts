/**
 * Pruebas de integración en QA (staging), después de cada despliegue.
 *
 * A diferencia de los E2E del CI (que levantan todo en la máquina del pipeline), estas van
 * contra el ambiente desplegado de verdad: la web en Railway, su proxy /api, la API, la base
 * PostGIS con las migraciones aplicadas y el bucket de fotos. Si alguna falla, el pipeline no
 * ofrece el pase a producción.
 *
 * Usan una cuenta de prueba de personal municipal que existe solo en QA (variables
 * QA_USUARIO_DNI y QA_USUARIO_CLAVE del ambiente "staging" de GitHub). Los reclamos que carga
 * quedan rechazados al final, así no aparecen en la cola del Tablero.
 */
import { expect, test, type APIRequestContext } from '@playwright/test'
import { reclamarPorApi } from '../e2e/vecino'

// En la compu, contra el stack local, sirve la operadora del README.
const CUENTA = {
  dni: process.env.QA_USUARIO_DNI ?? '20999888',
  clave: process.env.QA_USUARIO_CLAVE ?? 'clave-de-prueba-1',
}
// Dentro del ejido de Villa Allende (RN-06), lejos de donde cargan los vecinos de verdad.
const LUGAR = { latitud: -31.2945, longitud: -64.2955 }
const MAX_RECLAMOS_POR_DIA = 5 // RN-08
const COMMIT = (process.env.EXPECTED_COMMIT ?? 'local').slice(0, 7)

async function ingresarPorApi(api: APIRequestContext) {
  const respuesta = await api.post('/api/auth/ingreso', {
    data: { identificador: CUENTA.dni, password: CUENTA.clave },
  })
  expect(respuesta.status(), await respuesta.text()).toBe(200)
}

function diaEnCordoba(fecha: Date) {
  return fecha.toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Cordoba' })
}

test('QA-01 la base de QA tiene las migraciones y el catálogo de tipos', async ({ request }) => {
  const respuesta = await request.get('/api/tipos')

  expect(respuesta.ok()).toBe(true)
  const nombres = ((await respuesta.json()) as { nombre: string }[]).map((tipo) => tipo.nombre)
  expect(nombres).toEqual(expect.arrayContaining(['Bache', 'Luminaria rota', 'Semáforo roto']))
})

test('QA-02 sin sesión, la API no muestra datos privados ni el back office', async ({
  request,
}) => {
  expect((await request.get('/api/reclamos/mios')).status()).toBe(401)
  expect((await request.get('/api/gestion/reclamos')).status()).toBe(401)
})

test('QA-03 un ingreso con datos incorrectos muestra el error que manda la API', async ({
  page,
}) => {
  await page.goto('/ingresar')
  // Un DNI que no existe: no suma intentos fallidos a ninguna cuenta real (CU-03).
  await page.getByLabel('DNI o email').fill('10000001')
  await page.getByLabel('Contraseña', { exact: true }).fill('una-clave-equivocada')
  await page.getByRole('button', { name: 'Ingresar' }).click()

  await expect(page.getByText('DNI, email o contraseña incorrectos')).toBeVisible()
  await expect(page).toHaveURL(/\/ingresar$/)
})

test('QA-04 el personal municipal ingresa y ve el Tablero con datos de QA', async ({ page }) => {
  await page.goto('/ingresar')
  await page.getByLabel('DNI o email').fill(CUENTA.dni)
  await page.getByLabel('Contraseña', { exact: true }).fill(CUENTA.clave)
  await page.getByRole('button', { name: 'Ingresar' }).click()

  await expect(page).toHaveURL(/\/tablero$/)
  // El título dice cuántos reclamos trajo la API de la base de QA.
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    /^\d+ reclamos?\s*de mayor a menor prioridad$/,
  )
})

test('QA-05 recorrido completo: reclamo con foto en el bucket, cambio de estado y seguimiento', async ({
  page,
}) => {
  const api = page.request // comparte la cookie de sesión con la página
  await ingresarPorApi(api)

  // RN-08: la cuenta de prueba también tiene el límite de 5 reclamos por día. Si ya se usaron
  // (muchos despliegues en un día), esta prueba se saltea con el motivo a la vista en el informe.
  const mios = (await (await api.get('/api/reclamos/mios')).json()) as { creado_en: string }[]
  const hoy = diaEnCordoba(new Date())
  const deHoy = mios.filter((r) => diaEnCordoba(new Date(r.creado_en)) === hoy).length
  test.skip(
    deHoy >= MAX_RECLAMOS_POR_DIA,
    `La cuenta de prueba ya cargó ${deHoy} reclamos hoy (RN-08)`,
  )

  // 1. Carga un bache con foto: API + PostGIS (geocerca) + bucket S3 del ambiente.
  const numero = await reclamarPorApi(api, {
    ...LUGAR,
    gravedad: 2,
    descripcion: `Prueba automática del pipeline (commit ${COMMIT}). Se rechaza sola.`,
  })

  // 2. La foto quedó en el bucket y se puede bajar con la URL firmada que da la API.
  const detalle = (await (await api.get(`/api/reclamos/${numero}`)).json()) as {
    fotos: { url: string }[]
  }
  expect(detalle.fotos).toHaveLength(1)
  const foto = await api.get(detalle.fotos[0].url)
  expect(foto.status()).toBe(200)
  expect(foto.headers()['content-type']).toBe('image/jpeg')

  // 3. Aparece en la cola del Tablero (web real, con el mapa de MapLibre) y se abre el detalle.
  await page.goto('/tablero')
  await page
    .getByRole('list', { name: 'Reclamos por prioridad' })
    .getByRole('link')
    .filter({ hasText: new RegExp(`#${numero}(?!\\d)`) })
    .click()
  await expect(page.getByRole('heading', { name: `Bache #${numero}` })).toBeVisible()

  // 4. Cambio de estado desde la web (RN-05: rechazar exige el motivo).
  await page.getByRole('button', { name: 'Rechazar' }).click()
  await page.getByLabel('Motivo del rechazo').fill('Prueba automática del pipeline de QA')
  await page.getByRole('button', { name: 'Confirmar: Rechazar' }).click()
  await expect(page.getByText(/pasó a Rechazado/)).toBeVisible({ timeout: 15_000 })

  // 5. El seguimiento quedó guardado en la base: estado final e historial con el motivo.
  const final = (await (await api.get(`/api/reclamos/${numero}`)).json()) as {
    estado: string
    historial: { estado_nuevo: string; comentario: string | null }[]
  }
  expect(final.estado).toBe('RECHAZADO')
  expect(final.historial.at(-1)).toMatchObject({
    estado_nuevo: 'RECHAZADO',
    comentario: 'Prueba automática del pipeline de QA',
  })
})
