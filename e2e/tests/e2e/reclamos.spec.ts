import path from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { vecinoConSesion } from './vecino'

const FOTO = path.join(import.meta.dirname, '..', '..', 'fixtures', 'bache.jpg')

// En CI la app usa el mapa simulado (VITE_MAPA=simulado, ADR 0008); en local, el real.
const CENTRO_VILLA_ALLENDE = { latitude: -31.2945, longitude: -64.2955 }
const CORDOBA_CAPITAL = { latitude: -31.4167, longitude: -64.1833 }

async function hastaLaUbicacion(page: Page) {
  await page.goto('/')
  await page.getByRole('link', { name: 'Nuevo reclamo' }).click()
  await page.getByRole('button', { name: /Bache/ }).click()
  await page.getByLabel('Elegir de la galería').setInputFiles(FOTO)
  await page.getByRole('button', { name: 'Usar esta foto' }).click()
  await expect(page.getByText('Paso 3 de 5 · Ubicación')).toBeVisible()
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
    await page.getByRole('button', { name: 'Confirmar ubicación' }).click()
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
    await page.getByRole('button', { name: 'Confirmar ubicación' }).click()
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
