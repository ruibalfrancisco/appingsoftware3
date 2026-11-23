import { describe, expect, it } from 'vitest'
import { colorGravedad } from './detalles'
import { dentroDelEjido, desplazar } from './geocerca'
import { dimensionesReducidas, validarArchivo } from './imagen'

// Cuadrado de prueba: de (-64.30, -31.30) a (-64.28, -31.28), en formato GeoJSON [lng, lat].
const CUADRADO = [
  [-64.3, -31.3],
  [-64.28, -31.3],
  [-64.28, -31.28],
  [-64.3, -31.28],
  [-64.3, -31.3],
]

describe('geocerca en el navegador (RN-06, mismos criterios que UT-06)', () => {
  it.each([
    ['centro', -31.29, -64.29, true],
    ['afuera al norte', -31.27, -64.29, false],
    ['Córdoba capital', -31.4167, -64.1833, false],
    ['sobre un vértice', -31.3, -64.3, true],
    ['sobre un borde', -31.29, -64.28, true],
  ])('%s', (_lugar, latitud, longitud, esperado) => {
    expect(dentroDelEjido({ latitud, longitud }, CUADRADO)).toBe(esperado)
  })

  it('desplazar mueve unos metros', () => {
    const movida = desplazar({ latitud: -31.29, longitud: -64.29 }, 111.32, 0)
    expect(movida.latitud).toBeCloseTo(-31.289, 6)
    expect(movida.longitud).toBe(-64.29)
  })
})

describe('foto (RN-10)', () => {
  it('reduce a 1600 px de lado mayor sin agrandar', () => {
    expect(dimensionesReducidas(4000, 3000)).toEqual({ ancho: 1600, alto: 1200 })
    expect(dimensionesReducidas(3000, 4000)).toEqual({ ancho: 1200, alto: 1600 })
    expect(dimensionesReducidas(800, 600)).toEqual({ ancho: 800, alto: 600 })
  })

  it('acepta JPG, PNG y WEBP de hasta 10 MB', () => {
    const archivo = (tipo: string, bytes = 10) =>
      new File([new Uint8Array(bytes)], 'foto', { type: tipo })
    expect(validarArchivo(archivo('image/jpeg'))).toBeNull()
    expect(validarArchivo(archivo('image/webp'))).toBeNull()
    expect(validarArchivo(archivo('image/gif'))).toMatch(/JPG, PNG o WEBP/)
    expect(validarArchivo(archivo('image/png', 10 * 1024 * 1024 + 1))).toMatch(/10 MB/)
  })
})

it('el color de la gravedad va de verde a rojo', () => {
  expect(colorGravedad(1)).toBe('hsl(140 75% 30%)')
  expect(colorGravedad(10)).toBe('hsl(0 75% 30%)')
})
