import type { TipoReclamo } from '../api'

export interface ReclamoEnElMapa {
  id: number
  numero: number
  latitud: number
  longitud: number
  tipo: TipoReclamo
  estado?: string
}

export interface PropsMapaDeReclamos {
  reclamos: ReclamoEnElMapa[]
  /** Al tocar un pin. Sin esto, el mapa es solo para mirar: no se mueve ni hace zoom. */
  onElegir?: (id: number) => void
  /** Alto, bordes y sombra los pone quien lo usa. */
  className: string
  /** Color del pin: por defecto el del tipo; el Tablero lo pinta por estado (RF-26). */
  colorDe?: (reclamo: ReclamoEnElMapa) => string
  /** Agrupa los pines que se superponen y muestra cuántos hay (RF-26). */
  agrupar?: boolean
  /** El pin elegido se ve más grande. */
  seleccionado?: number
}

/** "Reclamo #12: Bache": el nombre de cada pin para lectores de pantalla y pruebas. */
export function nombreDelPin(reclamo: ReclamoEnElMapa): string {
  return `Reclamo #${reclamo.numero}: ${reclamo.tipo.nombre}`
}

export function colorDelTipo(reclamo: ReclamoEnElMapa): string {
  return reclamo.tipo.color
}
