import { describe, expect, it } from 'vitest'
import { esGravedadValida, etiquetaGravedad } from './gravedad'

describe('UT-08 etiqueta de gravedad (RN-03)', () => {
  it.each([
    [1, 'Leve'],
    [3, 'Leve'],
    [4, 'Moderado'],
    [6, 'Moderado'],
    [7, 'Grave'],
    [8, 'Grave'],
    [9, 'Urgente'],
    [10, 'Urgente'],
  ])('gravedad %i es %s', (valor, etiqueta) => {
    expect(etiquetaGravedad(valor)).toBe(etiqueta)
  })

  it.each([0, 11, 5.5, Number.NaN])('rechaza %d', (valor) => {
    expect(esGravedadValida(valor)).toBe(false)
    expect(() => etiquetaGravedad(valor)).toThrow(RangeError)
  })
})
