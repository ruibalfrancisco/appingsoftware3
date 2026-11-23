import { expect, test } from '@playwright/test'
import { enlaceDelEmail } from './mailpit'
import { vecinoNuevo } from './vecino'

test('E2E-01 registro, verificación por email e ingreso (CU-01 a CU-03)', async ({
  page,
  request,
}) => {
  const vecino = vecinoNuevo()

  await page.goto('/')
  await page.getByRole('link', { name: 'Crear cuenta' }).click()
  // El DNI con puntos, como lo escribe la gente.
  await page.getByLabel('DNI', { exact: true }).fill(`${vecino.dni.slice(0, 2)}.${vecino.dni.slice(2, 5)}.${vecino.dni.slice(5)}`)
  await page.getByLabel('Nombre', { exact: true }).fill(vecino.nombre)
  await page.getByLabel('Apellido', { exact: true }).fill(vecino.apellido)
  await page.getByLabel('Email', { exact: true }).fill(vecino.email)
  await page.getByLabel('Contraseña', { exact: true }).fill(vecino.password)
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Crear cuenta' }).click()

  await expect(page.getByRole('heading', { name: 'Revisá tu correo' })).toBeVisible()

  // Sin confirmar el email todavía no puede entrar.
  await page.goto('/ingresar')
  await page.getByLabel('DNI o email').fill(vecino.dni)
  await page.getByLabel('Contraseña', { exact: true }).fill(vecino.password)
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page.getByRole('alert')).toContainText('confirmaste tu email')

  const enlace = await enlaceDelEmail(request, vecino.email, /Confirmá tu email/, '/verificar')
  await page.goto(enlace)
  await expect(page.getByRole('heading', { name: `¡Listo, ${vecino.nombre}!` })).toBeVisible()
  await page.getByRole('link', { name: 'Ir al inicio' }).click()
  await expect(page.getByRole('heading', { name: `Hola, ${vecino.nombre}` })).toBeVisible()

  // La sesión vive en una cookie httpOnly: JavaScript no la ve.
  const cookies = await page.context().cookies()
  expect(cookies.find((c) => c.name === 'sesion')).toEqual(
    expect.objectContaining({ httpOnly: true, sameSite: 'Lax' }),
  )
  expect(await page.evaluate(() => document.cookie)).not.toContain('sesion')

  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await expect(page.getByRole('link', { name: 'Crear cuenta' })).toBeVisible()

  await page.getByRole('link', { name: 'Ya tengo cuenta' }).click()
  await page.getByLabel('DNI o email').fill(vecino.email.toUpperCase())
  await page.getByLabel('Contraseña', { exact: true }).fill(vecino.password)
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page.getByRole('heading', { name: `Hola, ${vecino.nombre}` })).toBeVisible()
})

test('CU-11 recuperar la contraseña desde el email', async ({ page, request }) => {
  const vecino = vecinoNuevo()
  const respuesta = await request.post('/api/auth/registro', {
    data: { ...vecino, acepta_terminos: true },
  })
  expect(respuesta.status()).toBe(201)
  await page.goto(await enlaceDelEmail(request, vecino.email, /Confirmá tu email/, '/verificar'))
  await expect(page.getByRole('heading', { name: `¡Listo, ${vecino.nombre}!` })).toBeVisible()
  await page.context().clearCookies()

  await page.goto('/ingresar')
  await page.getByRole('link', { name: 'Olvidé mi contraseña' }).click()
  await page.getByLabel('Email', { exact: true }).fill(vecino.email)
  await page.getByRole('button', { name: 'Enviar enlace' }).click()
  await expect(page.getByRole('status')).toContainText('Revisá tu correo')

  await page.goto(await enlaceDelEmail(request, vecino.email, /Cambiá tu contraseña/, '/restablecer'))
  await page.getByLabel('Contraseña nueva').fill('otra-clave-nueva')
  await page.getByLabel('Repetila').fill('otra-clave-nueva')
  await page.getByRole('button', { name: 'Guardar contraseña' }).click()

  await expect(page.getByRole('status')).toContainText('ya podés ingresar')
  await page.getByLabel('DNI o email').fill(vecino.dni)
  await page.getByLabel('Contraseña', { exact: true }).fill('otra-clave-nueva')
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page.getByRole('heading', { name: `Hola, ${vecino.nombre}` })).toBeVisible()
})
