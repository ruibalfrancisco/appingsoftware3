import { describe, expect, it } from 'vitest'
import { fecha, fechaYHora, textoDeUbicacion } from './formato'

describe('fechas en la hora de Córdoba (RNF-14)', () => {
  it('fecha y hora en 24 h', () => {
    expect(fechaYHora('2026-11-23T13:05:00Z')).toBe('23/11/2026, 10:05')
    expect(fechaYHora('2026-11-24T03:12:00Z')).toBe('24/11/2026, 00:12')
  })

  it('el día es el de Córdoba, no el de UTC', () => {
    expect(fecha('2026-11-24T02:30:00Z')).toBe('23/11/2026')
  })
})

describe('texto de la ubicación', () => {
  it('usa la dirección si se conoce', () => {
    expect(textoDeUbicacion({ direccion: 'San Martín 450', latitud: -31.3, longitud: -64.3 })).toBe(
      'San Martín 450',
    )
  })

  it('si no, las coordenadas del pin', () => {
    expect(textoDeUbicacion({ direccion: null, latitud: -31.2945, longitud: -64.2955 })).toBe(
      '-31.29450, -64.29550',
    )
  })
})
