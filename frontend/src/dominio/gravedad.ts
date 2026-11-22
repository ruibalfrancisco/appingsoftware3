/** RN-03: la gravedad es un entero del 1 al 10 con cuatro etiquetas. */
export type EtiquetaGravedad = 'Leve' | 'Moderado' | 'Grave' | 'Urgente'

export const GRAVEDAD_MIN = 1
export const GRAVEDAD_MAX = 10

export function esGravedadValida(valor: number): boolean {
  return Number.isInteger(valor) && valor >= GRAVEDAD_MIN && valor <= GRAVEDAD_MAX
}

export function etiquetaGravedad(valor: number): EtiquetaGravedad {
  if (!esGravedadValida(valor)) {
    throw new RangeError(`Gravedad fuera de rango: ${valor}`)
  }
  if (valor <= 3) return 'Leve'
  if (valor <= 6) return 'Moderado'
  if (valor <= 8) return 'Grave'
  return 'Urgente'
}
