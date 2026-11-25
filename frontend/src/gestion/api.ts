import { useQuery } from '@tanstack/react-query'
import { enviarFormulario, pedir } from '../api'
import type { EntradaDeHistorial, Foto, TipoReclamo } from '../reclamos/api'

export interface Area {
  id: number
  nombre: string
}

/** Una fila del Tablero y un marcador de su mapa (CU-07, CU-09). */
export interface ReclamoEnTablero {
  id: number
  numero: number
  tipo: TipoReclamo
  estado: string
  area: string | null
  descripcion: string
  direccion: string | null
  latitud: number
  longitud: number
  cantidad_apoyos: number
  gravedad_promedio: number
  prioridad: number
  creado_en: string
  foto_url: string | null
}

/** RF-27: el detalle para el personal municipal, con los cambios de estado posibles. */
export interface ReclamoDeGestion {
  id: number
  numero: number
  tipo: TipoReclamo
  estado: string
  area: Area | null
  descripcion: string
  direccion: string | null
  latitud: number
  longitud: number
  cantidad_apoyos: number
  gravedad_promedio: number
  prioridad: number
  creado_en: string
  actualizado_en: string
  cerrado_en: string | null
  fotos: Foto[]
  historial: (EntradaDeHistorial & { autor: string })[]
  transiciones: string[]
}

/** Los filtros del Tablero viven en la URL: se comparten y sobreviven a recargar. */
export interface Filtros {
  tipo?: string
  /** Un estado, "todos" o nada (los abiertos). */
  estado?: string
  area?: string
  desde?: string
  hasta?: string
}

export const TODOS_LOS_ESTADOS = 'todos'
const TODOS = ['PENDIENTE', 'EN_REVISION', 'EN_PROCESO', 'RESUELTO', 'RECHAZADO']

export function consultaDelTablero(filtros: Filtros): string {
  const consulta = new URLSearchParams()
  if (filtros.tipo) consulta.set('tipo_id', filtros.tipo)
  if (filtros.estado === TODOS_LOS_ESTADOS) TODOS.forEach((e) => consulta.append('estado', e))
  else if (filtros.estado) consulta.set('estado', filtros.estado)
  if (filtros.area) consulta.set('area_id', filtros.area)
  if (filtros.desde) consulta.set('desde', filtros.desde)
  if (filtros.hasta) consulta.set('hasta', filtros.hasta)
  return consulta.toString()
}

export function useTablero(filtros: Filtros) {
  const consulta = consultaDelTablero(filtros)
  return useQuery({
    queryKey: ['gestion', 'reclamos', consulta],
    queryFn: ({ signal }) => pedir<ReclamoEnTablero[]>(`/gestion/reclamos?${consulta}`, { signal }),
    // La cola cambia sola (reclamos y apoyos nuevos): se refresca cada minuto.
    refetchInterval: 60_000,
  })
}

export function useAreas() {
  return useQuery({
    queryKey: ['gestion', 'areas'],
    queryFn: ({ signal }) => pedir<Area[]>('/gestion/areas', { signal }),
    staleTime: Infinity,
  })
}

export function useReclamoDeGestion(id: number) {
  return useQuery({
    queryKey: ['gestion', 'reclamo', id],
    queryFn: ({ signal }) => pedir<ReclamoDeGestion>(`/gestion/reclamos/${id}`, { signal }),
  })
}

export interface CambioDeEstado {
  estado: string
  comentario?: string
  areaId?: number
  foto?: Blob
}

export interface CambioRegistrado {
  estado: string
  transiciones: string[]
  notificados: number
}

/** CU-08: multipart porque al resolver puede ir la foto del "después" (RF-30). */
export function cambiarEstado(id: number, cambio: CambioDeEstado) {
  const formulario = new FormData()
  formulario.append('estado', cambio.estado)
  if (cambio.comentario) formulario.append('comentario', cambio.comentario)
  if (cambio.areaId !== undefined) formulario.append('area_id', String(cambio.areaId))
  if (cambio.foto) formulario.append('foto', cambio.foto, 'despues.jpg')
  return enviarFormulario<CambioRegistrado>(`/gestion/reclamos/${id}/estado`, formulario)
}
