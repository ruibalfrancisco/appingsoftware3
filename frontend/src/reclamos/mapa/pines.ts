import type { TipoReclamo } from '../api'

export interface ReclamoEnElMapa {
  id: number
  numero: number
  latitud: number
  longitud: number
  tipo: TipoReclamo
}

export interface PropsMapaDeReclamos {
  reclamos: ReclamoEnElMapa[]
  /** Al tocar un pin. Sin esto, el mapa es solo para mirar: no se mueve ni hace zoom. */
  onElegir?: (id: number) => void
  /** Alto, bordes y sombra los pone quien lo usa. */
  className: string
}

/** "Reclamo #12: Bache": el nombre de cada pin para lectores de pantalla y pruebas. */
export function nombreDelPin(reclamo: ReclamoEnElMapa): string {
  return `Reclamo #${reclamo.numero}: ${reclamo.tipo.nombre}`
}
