import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ANA, renderizarEn, saludOk, simularApi, sinSesion } from '../test/utilidades'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('Inicio', () => {
  it('sin sesión ofrece crear cuenta o ingresar, y muestra el estado de la API', async () => {
    simularApi({ ...sinSesion, ...saludOk })
    renderizarEn('/')

    expect(await screen.findByRole('link', { name: 'Crear cuenta' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Ya tengo cuenta' })).toBeVisible()
    expect(await screen.findByText('API conectada')).toBeVisible()
    expect(screen.getByText(/v0\.1\.0 · local/)).toBeVisible()
  })

  it('con sesión saluda y permite cerrarla', async () => {
    const api = simularApi({
      ...saludOk,
      'GET /auth/yo': () => ({ status: 200, json: ANA }),
      'POST /auth/salir': () => ({ status: 204 }),
    })
    renderizarEn('/')

    expect(await screen.findByRole('heading', { name: 'Hola, Ana' })).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }))

    expect(await screen.findByRole('link', { name: 'Crear cuenta' })).toBeVisible()
    expect(api).toHaveBeenCalledWith('/api/auth/salir', expect.objectContaining({ method: 'POST' }))
  })

  it('avisa si la API no responde', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    simularApi({ ...sinSesion, 'GET /health': () => ({ status: 503 }) })
    renderizarEn('/')

    expect(await screen.findByText('No se pudo conectar con la API')).toBeVisible()
  })
})

describe('Registro (CU-01)', () => {
  it('valida en el navegador antes de enviar', async () => {
    const api = simularApi(sinSesion)
    renderizarEn('/registro')

    await userEvent.click(await screen.findByRole('button', { name: 'Crear cuenta' }))

    expect(await screen.findByText('El DNI tiene que tener 7 u 8 dígitos')).toBeVisible()
    expect(screen.getByLabelText('DNI')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText('Tenés que aceptar los términos para seguir')).toBeVisible()
    expect(api).not.toHaveBeenCalledWith('/api/auth/registro', expect.anything())
  })

  it('envía los datos normalizados y pide revisar el correo', async () => {
    const api = simularApi({
      'POST /auth/registro': () => ({ status: 201, json: { mensaje: 'ok' } }),
    })
    renderizarEn('/registro')

    await userEvent.type(await screen.findByLabelText('DNI'), '30.123.456')
    await userEvent.type(screen.getByLabelText('Nombre'), 'Ana')
    await userEvent.type(screen.getByLabelText('Apellido'), 'Pérez')
    await userEvent.type(screen.getByLabelText('Email'), 'Ana@Ejemplo.com')
    await userEvent.type(screen.getByLabelText('Contraseña'), 'una-clave-segura')
    await userEvent.click(screen.getByRole('checkbox'))
    await userEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }))

    expect(await screen.findByRole('heading', { name: 'Revisá tu correo' })).toBeVisible()
    expect(screen.getByText('ana@ejemplo.com')).toBeVisible()
    const [, init] = api.mock.calls.find(([url]) => url === '/api/auth/registro')!
    expect(JSON.parse(String(init?.body))).toEqual(
      expect.objectContaining({ dni: '30123456', email: 'ana@ejemplo.com', acepta_terminos: true }),
    )
  })

  it('muestra el error del backend sin perder lo cargado (CU-01 3a)', async () => {
    simularApi({
      'POST /auth/registro': () => ({
        status: 409,
        json: { detail: 'Ya existe una cuenta con ese DNI o ese email.' },
      }),
    })
    renderizarEn('/registro')

    await userEvent.type(await screen.findByLabelText('DNI'), '30123456')
    await userEvent.type(screen.getByLabelText('Nombre'), 'Ana')
    await userEvent.type(screen.getByLabelText('Apellido'), 'Pérez')
    await userEvent.type(screen.getByLabelText('Email'), 'ana@ejemplo.com')
    await userEvent.type(screen.getByLabelText('Contraseña'), 'una-clave-segura')
    await userEvent.click(screen.getByRole('checkbox'))
    await userEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Ya existe una cuenta')
    expect(screen.getByLabelText('DNI')).toHaveValue('30123456')
  })
})

describe('Revisá tu correo', () => {
  it('permite reenviar el email', async () => {
    const api = simularApi({
      'POST /auth/reenviar-verificacion': () => ({ status: 202, json: { mensaje: 'ok' } }),
    })
    const { router } = renderizarEn('/')
    await router.navigate('/revisa-tu-correo', { state: { email: 'ana@ejemplo.com' } })

    await userEvent.click(await screen.findByRole('button', { name: 'Reenviar email' }))

    expect(await screen.findByText('Listo, te mandamos un enlace nuevo.')).toBeVisible()
    expect(api).toHaveBeenCalledWith(
      '/api/auth/reenviar-verificacion',
      expect.objectContaining({ body: '{"email":"ana@ejemplo.com"}' }),
    )
  })
})

describe('Verificar (CU-02)', () => {
  it('envía el token una sola vez e inicia sesión', async () => {
    const api = simularApi({ 'POST /auth/verificar': () => ({ status: 200, json: ANA }) })
    renderizarEn('/verificar?token=token-de-prueba-largo-123')

    expect(await screen.findByRole('heading', { name: '¡Listo, Ana!' })).toBeVisible()
    const llamadas = api.mock.calls.filter(([url]) => url === '/api/auth/verificar')
    expect(llamadas).toHaveLength(1)
  })

  it('enlace vencido o usado', async () => {
    simularApi({
      'POST /auth/verificar': () => ({
        status: 400,
        json: { detail: 'El enlace venció o ya se usó. Pedí uno nuevo.' },
      }),
    })
    renderizarEn('/verificar?token=token-de-prueba-largo-123')

    expect(await screen.findByRole('alert')).toHaveTextContent('venció o ya se usó')
  })

  it('sin token', async () => {
    simularApi({})
    renderizarEn('/verificar')
    expect(await screen.findByRole('alert')).toHaveTextContent('incompleto')
  })
})

describe('Ingreso (CU-03)', () => {
  async function ingresar(identificador: string, password: string) {
    await userEvent.type(await screen.findByLabelText('DNI o email'), identificador)
    await userEvent.type(screen.getByLabelText('Contraseña'), password)
    await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }))
  }

  it('con datos correctos vuelve al inicio con la sesión iniciada', async () => {
    simularApi({ ...saludOk, 'POST /auth/ingreso': () => ({ status: 200, json: ANA }) })
    const { router } = renderizarEn('/ingresar')

    await ingresar('30123456', 'una-clave-segura')

    expect(await screen.findByRole('heading', { name: 'Hola, Ana' })).toBeVisible()
    expect(router.state.location.pathname).toBe('/')
  })

  it('credenciales incorrectas: mensaje genérico', async () => {
    simularApi({
      'POST /auth/ingreso': () => ({
        status: 401,
        json: { detail: 'DNI, email o contraseña incorrectos' },
      }),
    })
    renderizarEn('/ingresar')

    await ingresar('30123456', 'mala')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'DNI, email o contraseña incorrectos',
    )
  })

  it('email sin confirmar: ofrece reenviar el email', async () => {
    const api = simularApi({
      'POST /auth/ingreso': () => ({ status: 403, json: { detail: 'Todavía no confirmaste' } }),
      'POST /auth/reenviar-verificacion': () => ({ status: 202, json: { mensaje: 'ok' } }),
    })
    renderizarEn('/ingresar')

    await ingresar('ana@ejemplo.com', 'una-clave-segura')
    await userEvent.click(
      await screen.findByRole('button', { name: 'Reenviar el email de confirmación' }),
    )

    expect(await screen.findByText('Listo, revisá tu correo')).toBeVisible()
    expect(api).toHaveBeenCalledWith('/api/auth/reenviar-verificacion', expect.anything())
  })
})

describe('Recuperar y restablecer (CU-11)', () => {
  it('pide el enlace y muestra el aviso genérico', async () => {
    simularApi({
      'POST /auth/recuperar': () => ({ status: 202, json: { mensaje: 'Revisá tu correo.' } }),
    })
    renderizarEn('/recuperar')

    await userEvent.type(await screen.findByLabelText('Email'), 'ana@ejemplo.com')
    await userEvent.click(screen.getByRole('button', { name: 'Enviar enlace' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Revisá tu correo.')
  })

  it('cambia la contraseña y lleva a ingresar con el aviso', async () => {
    const api = simularApi({
      ...sinSesion,
      'POST /auth/restablecer': () => ({
        status: 200,
        json: { mensaje: 'Listo: ya podés ingresar' },
      }),
    })
    renderizarEn('/restablecer?token=token-de-prueba-largo-123')

    await userEvent.type(await screen.findByLabelText('Contraseña nueva'), 'clave-nueva-1')
    await userEvent.type(screen.getByLabelText('Repetila'), 'clave-nueva-1')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }))

    expect(await screen.findByRole('heading', { name: 'Ingresar' })).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent('Listo: ya podés ingresar')
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith(
        '/api/auth/restablecer',
        expect.objectContaining({
          body: '{"token":"token-de-prueba-largo-123","password":"clave-nueva-1"}',
        }),
      ),
    )
  })

  it('restablecer sin token', async () => {
    simularApi({})
    renderizarEn('/restablecer')
    expect(await screen.findByRole('alert')).toHaveTextContent('Abrí el enlace de nuevo')
  })
})
