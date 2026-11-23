import type { Posicion } from './api'

/** Anillo exterior del polígono en formato GeoJSON: [[longitud, latitud], ...]. */
export type Anillo = number[][]

const TOLERANCIA = 1e-9

function sobreElSegmento(x: number, y: number, [x1, y1]: number[], [x2, y2]: number[]) {
  const cruz = (x - x1) * (y2 - y1) - (y - y1) * (x2 - x1)
  if (Math.abs(cruz) > TOLERANCIA) return false
  return (
    Math.min(x1, x2) - TOLERANCIA <= x &&
    x <= Math.max(x1, x2) + TOLERANCIA &&
    Math.min(y1, y2) - TOLERANCIA <= y &&
    y <= Math.max(y1, y2) + TOLERANCIA
  )
}

/**
 * RN-06 en el navegador: deshabilita "Confirmar" si el pin queda afuera (RF-09).
 * Mismo criterio que el backend: el borde cuenta como adentro. El backend vuelve a validar.
 */
export function dentroDelEjido({ latitud, longitud }: Posicion, anillo: Anillo): boolean {
  const [x, y] = [longitud, latitud]
  let adentro = false
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const [xi, yi] = anillo[i]
    const [xj, yj] = anillo[j]
    if (sobreElSegmento(x, y, anillo[j], anillo[i])) return true
    const cruza = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
    if (cruza) adentro = !adentro
  }
  return adentro
}

/** Mueve una posición tantos metros al norte y al este (para el mapa simulado). */
export function desplazar(p: Posicion, metrosNorte: number, metrosEste: number): Posicion {
  const metrosPorGrado = 111_320
  return {
    latitud: p.latitud + metrosNorte / metrosPorGrado,
    longitud: p.longitud + metrosEste / (metrosPorGrado * Math.cos((p.latitud * Math.PI) / 180)),
  }
}
