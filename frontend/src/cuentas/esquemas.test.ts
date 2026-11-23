import { describe, expect, it } from 'vitest'
import { esquemaIngreso, esquemaRegistro, esquemaRestablecer } from './esquemas'

const VALIDO = {
  dni: '30.123.456',
  nombre: ' Ana ',
  apellido: 'Pérez',
  email: ' Ana@Ejemplo.COM ',
  password: 'una-clave-segura',
  acepta_terminos: true,
}

describe('registro (CU-01, RN-09)', () => {
  it('normaliza DNI, nombre y email como el backend', () => {
    expect(esquemaRegistro.parse(VALIDO)).toEqual({
      ...VALIDO,
      dni: '30123456',
      nombre: 'Ana',
      email: 'ana@ejemplo.com',
    })
  })

  it.each([
    ['dni', '123456', 'El DNI tiene que tener 7 u 8 dígitos'],
    ['dni', '12A45678', 'El DNI tiene que tener 7 u 8 dígitos'],
    ['email', 'no-es-email', 'Revisá el email'],
    ['password', 'corta', 'Al menos 8 caracteres'],
    ['nombre', '   ', 'Completá tu nombre'],
    ['acepta_terminos', false, 'Tenés que aceptar los términos para seguir'],
  ])('%s inválido (%s)', (campo, valor, mensaje) => {
    const resultado = esquemaRegistro.safeParse({ ...VALIDO, [campo]: valor })
    expect(resultado.success).toBe(false)
    expect(resultado.error?.issues[0]).toEqual(
      expect.objectContaining({ path: [campo], message: mensaje }),
    )
  })
})

it('ingreso pide los dos campos', () => {
  const resultado = esquemaIngreso.safeParse({ identificador: ' ', password: '' })
  expect(resultado.error?.issues.map((i) => i.path[0])).toEqual(['identificador', 'password'])
})

it('restablecer exige que las contraseñas coincidan', () => {
  const resultado = esquemaRestablecer.safeParse({ password: 'clave-nueva-1', repetir: 'otra' })
  expect(resultado.error?.issues[0]).toEqual(
    expect.objectContaining({ path: ['repetir'], message: 'Las contraseñas no coinciden' }),
  )
})
