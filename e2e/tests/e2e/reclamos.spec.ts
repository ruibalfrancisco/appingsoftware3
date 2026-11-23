import { expect, test, type Page } from '@playwright/test'
import { FOTO, otroVecinoReclama, vecinoConSesion } from './vecino'

// En CI la app usa el mapa simulado (VITE_MAPA=simulado, ADR 0008); en local, el real.
const CENTRO_VILLA_ALLENDE = { latitude: -31.2945, longitude: -64.2955 }
const CORDOBA_CAPITAL = { latitude: -31.4167, longitude: -64.1833 }
// Un punto de Villa Allende que solo usa E2E-03, a ~330 m del centro.
const LUGAR_DEL_SIMILAR = { latitude: -31.2975, longitude: -64.2955 }

async function hastaLaUbicacion(page: Page) {
  await page.goto('/')
  await page.getByRole('link', { name: 'Nuevo reclamo' }).click()
  await page.getByRole('button', { name: /Bache/ }).click()
  await page.getByLabel('Elegir de la galería').setInputFiles(FOTO)
  await page.getByRole('button', { name: 'Usar esta foto' }).click()
  await expect(page.getByText('Paso 3 de 5 · Ubicación')).toBeVisible()
}

/** Confirma el pin. Si otras pruebas ya dejaron baches cerca (RN-01), sigue con uno nuevo. */
async function confirmarUbicacion(page: Page) {
  await page.getByRole('button', { name: 'Confirmar ubicación' }).click()
  const hoja = page.getByRole('dialog', { name: '¿Es alguno de estos?' })
  // Busca reclamos parecidos en la API: más margen que el de 5 s por defecto.
  await expect(hoja.or(page.getByLabel('Descripción'))).toBeVisible({ timeout: 10_000 })
  if (await hoja.isVisible()) await hoja.getByRole('button', { name: /No es ninguno/ }).click()
}

test.describe('con GPS en Villa Allende', () => {
  test.use({ geolocation: CENTRO_VILLA_ALLENDE, permissions: ['geolocation'] })

  test('E2E-02 crear un reclamo completo en menos de 60 segundos (CU-04, RNF-01)', async ({
    page,
    request,
  }) => {
    await vecinoConSesion(page, request)
    const inicio = Date.now()

    await hastaLaUbicacion(page)
    await confirmarUbicacion(page)
    // Sin título: el reclamo se nombra por su tipo; el vecino solo lo describe.
    await page.getByLabel('Descripción').fill('Hay que esquivarlo con el auto')
    const gravedad = page.getByRole('slider')
    await gravedad.focus()
    for (let i = 0; i < 3; i++) await gravedad.press('ArrowRight') // 5 → 8
    await page.getByRole('button', { name: 'Revisar' }).click()

    const resumen = page.getByRole('region', { name: 'Resumen del reclamo' })
    await expect(resumen).toContainText('Hay que esquivarlo con el auto')
    await expect(resumen).toContainText('8 · Grave')
    await page.getByRole('button', { name: 'Enviar reclamo' }).click()

    // Sube y procesa la foto: más margen que el de 5 s por defecto.
    await expect(page.getByRole('heading', { name: '¡Reclamo enviado!' })).toBeVisible({
      timeout: 15_000,
    })
    expect(Date.now() - inicio).toBeLessThan(60_000)

    await page.getByRole('link', { name: 'Ver mi reclamo' }).click()
    await expect(page.getByRole('heading', { name: 'Bache', exact: true })).toBeVisible()
    await expect(page.getByText('Hay que esquivarlo con el auto')).toBeVisible()
    await expect(page.getByText('Pendiente')).toBeVisible()
    // La foto viene del bucket con URL firmada: tiene que cargar de verdad.
    const foto = page.getByRole('img', { name: /Foto del reclamo/ })
    await expect(foto).toBeVisible()
    await expect
      .poll(() => foto.evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBe(1600)
  })

  test('Mis reclamos: lo cargado aparece con su ubicación, en la lista y en el mapa', async ({
    page,
    request,
  }) => {
    await vecinoConSesion(page, request)
    await hastaLaUbicacion(page)
    await confirmarUbicacion(page)
    await page.getByLabel('Descripción').fill('Bache frente a la plaza')
    await page.getByLabel('Dirección o referencia (opcional)').fill('San Martín 450')
    await page.getByRole('button', { name: 'Revisar' }).click()
    await page.getByRole('button', { name: 'Enviar reclamo' }).click()
    // Sube y procesa la foto: más margen que el de 5 s por defecto.
    await expect(page.getByRole('heading', { name: '¡Reclamo enviado!' })).toBeVisible({
      timeout: 15_000,
    })

    await page.getByRole('link', { name: 'Volver al inicio' }).click()
    await page.getByRole('link', { name: 'Mis reclamos' }).click()

    const lista = page.getByRole('list', { name: 'Tus reclamos' })
    await expect(lista.getByRole('listitem')).toHaveCount(1)
    await expect(lista).toContainText('Bache')
    await expect(lista).toContainText('San Martín 450')
    await expect(lista).toContainText('Pendiente')
    // El pin del mapa lleva al detalle, que también muestra dónde está.
    await page.getByRole('button', { name: /^Reclamo #\d+: Bache$/ }).click()
    await expect(page.getByRole('heading', { name: 'Bache', exact: true })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Ubicación' })).toContainText('San Martín 450')
  })
})

test.describe('con GPS donde otro vecino ya reportó un bache', () => {
  test.use({ geolocation: LUGAR_DEL_SIMILAR, permissions: ['geolocation'] })

  test('E2E-03 encontrar un similar y apoyarlo (CU-05, RN-04)', async ({
    page,
    request,
    playwright,
    baseURL,
  }) => {
    const otro = await playwright.request.newContext({ baseURL })
    const numero = await otroVecinoReclama(otro, {
      latitud: LUGAR_DEL_SIMILAR.latitude,
      longitud: LUGAR_DEL_SIMILAR.longitude,
      gravedad: 5,
      descripcion: 'Bache hondo frente al kiosco',
    })
    await otro.dispose()

    await vecinoConSesion(page, request)
    await hastaLaUbicacion(page)
    await page.getByRole('button', { name: 'Confirmar ubicación' }).click()

    const hoja = page.getByRole('dialog', { name: '¿Es alguno de estos?' })
    const tarjeta = hoja.getByRole('article', { name: `Reclamo #${numero}` })
    await expect(tarjeta).toContainText('Bache hondo frente al kiosco')
    await expect(tarjeta).toContainText('1 apoyo')
    await tarjeta.getByRole('button', { name: 'Yo también lo vi' }).click()
    const gravedad = tarjeta.getByRole('slider')
    await gravedad.focus()
    for (let i = 0; i < 2; i++) await gravedad.press('ArrowRight') // 5 → 7
    await tarjeta.getByRole('button', { name: 'Sumar mi apoyo' }).click()

    await expect(page.getByRole('heading', { name: '¡Gracias por sumar tu apoyo!' })).toBeVisible()
    await expect(page.getByRole('main')).toContainText('2 apoyos')
    // RN-04: gravedad promedio (5 + 7) / 2 = 6 con 2 vecinos → 6 × (1 + log2 2) = 12.
    const reclamo = await (await page.request.get(`/api/reclamos/${numero}`)).json()
    expect(reclamo).toMatchObject({ cantidad_apoyos: 2, gravedad_promedio: 6, prioridad: 12 })

    await page.getByRole('link', { name: 'Ver el reclamo' }).click()
    await expect(page.getByRole('heading', { name: 'Bache', exact: true })).toBeVisible()
    await expect(page.getByText('6.0 · Moderado')).toBeVisible()
  })
})

test.describe('con GPS en Córdoba capital', () => {
  test.use({ geolocation: CORDOBA_CAPITAL, permissions: ['geolocation'] })

  test('E2E-05 el pin fuera de Villa Allende bloquea la confirmación (CU-04 4a)', async ({
    page,
    request,
  }) => {
    await vecinoConSesion(page, request)

    await hastaLaUbicacion(page)

    await expect(page.getByRole('alert')).toContainText('fuera de Villa Allende')
    await expect(page.getByRole('button', { name: 'Confirmar ubicación' })).toBeDisabled()
  })
})
