import { readFileSync } from 'node:fs'
import path from 'node:path'
import { expect, type APIRequestContext, type Page } from '@playwright/test'
import { enlaceDelEmail } from './mailpit'

export const FOTO = path.join(import.meta.dirname, '..', '..', 'fixtures', 'bache.jpg')

/** Un vecino distinto por prueba: DNI y email únicos para que las corridas no choquen. */
export function vecinoNuevo() {
  const sufijo = String(Math.floor(Math.random() * 10_000_000)).padStart(7, '0')
  return {
    dni: `4${sufijo}`,
    nombre: 'Lucía',
    apellido: 'Gómez',
    email: `lucia.${sufijo}@ejemplo.com`,
    password: 'clave-de-prueba-1',
  }
}

/** Registra un vecino por la API, abre el enlace del email y queda con la sesión iniciada. */
export async function vecinoConSesion(page: Page, request: APIRequestContext) {
  const vecino = vecinoNuevo()
  const registro = await request.post('/api/auth/registro', {
    data: { ...vecino, acepta_terminos: true },
  })
  expect(registro.status()).toBe(201)
  await page.goto(await enlaceDelEmail(request, vecino.email, /Confirmá tu email/, '/verificar'))
  await expect(page.getByRole('heading', { name: `¡Listo, ${vecino.nombre}!` })).toBeVisible()
  return vecino
}

/**
 * Otro vecino, solo por la API (con su propio contexto y su propia cookie): se registra,
 * confirma el email y carga un bache. Devuelve el número de reclamo.
 */
export async function otroVecinoReclama(
  api: APIRequestContext,
  reclamo: { latitud: number; longitud: number; gravedad: number; descripcion: string },
): Promise<number> {
  const vecino = vecinoNuevo()
  const registro = await api.post('/api/auth/registro', {
    data: { ...vecino, acepta_terminos: true },
  })
  expect(registro.status()).toBe(201)
  const enlace = await enlaceDelEmail(api, vecino.email, /Confirmá tu email/, '/verificar')
  const token = new URL(enlace).searchParams.get('token')
  expect((await api.post('/api/auth/verificar', { data: { token } })).ok()).toBe(true)

  const respuesta = await api.post('/api/reclamos', {
    multipart: {
      tipo_id: '1', // Bache
      descripcion: reclamo.descripcion,
      gravedad: String(reclamo.gravedad),
      latitud: String(reclamo.latitud),
      longitud: String(reclamo.longitud),
      foto: { name: 'bache.jpg', mimeType: 'image/jpeg', buffer: readFileSync(FOTO) },
    },
  })
  expect(respuesta.status(), await respuesta.text()).toBe(201)
  return ((await respuesta.json()) as { numero: number }).numero
}
