import { afterEach, describe, expect, it, vi } from 'vitest'
import { ErrorDeApi, SIN_CONEXION, errorDesdeRespuesta, pedir } from './api'

afterEach(() => vi.unstubAllGlobals())

describe('errores de la API', () => {
  it('usa el detail de texto como mensaje', () => {
    const error = errorDesdeRespuesta(409, { detail: 'Ya existe una cuenta' })
    expect(error).toEqual(expect.objectContaining({ status: 409, message: 'Ya existe una cuenta' }))
  })

  it('lleva los errores de validación de FastAPI a cada campo', () => {
    const error = errorDesdeRespuesta(422, {
      detail: [
        { loc: ['body', 'dni'], msg: 'Value error, El DNI tiene que tener 7 u 8 dígitos' },
        { loc: ['body', 'email'], msg: 'value is not a valid email address' },
      ],
    })
    expect(error.campos).toEqual({
      dni: 'El DNI tiene que tener 7 u 8 dígitos',
      email: 'value is not a valid email address',
    })
  })

  it('sin detail usa un mensaje genérico', () => {
    expect(errorDesdeRespuesta(500, null).message).toMatch(/Algo salió mal/)
  })
})

describe('pedir', () => {
  it('manda JSON a /api con la cookie del mismo sitio', async () => {
    const fetchFalso = vi.fn().mockResolvedValue(new Response('{"ok":true}', { status: 200 }))
    vi.stubGlobal('fetch', fetchFalso)

    await expect(pedir('/auth/ingreso', { metodo: 'POST', cuerpo: { a: 1 } })).resolves.toEqual({
      ok: true,
    })
    expect(fetchFalso).toHaveBeenCalledWith(
      '/api/auth/ingreso',
      expect.objectContaining({ method: 'POST', body: '{"a":1}', credentials: 'same-origin' }),
    )
  })

  it('204 no tiene cuerpo', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })))
    await expect(pedir('/auth/salir', { metodo: 'POST' })).resolves.toBeUndefined()
  })

  it('sin red avisa que no hay conexión', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await expect(pedir('/health')).rejects.toEqual(new ErrorDeApi(0, SIN_CONEXION))
  })
})
