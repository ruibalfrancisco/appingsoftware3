import { expect, type APIRequestContext, type Page } from '@playwright/test'
import { enlaceDelEmail } from './mailpit'

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
