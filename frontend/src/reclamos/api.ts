import { useQuery } from '@tanstack/react-query'
import { API_BASE, ErrorDeApi, errorDesdeRespuesta, pedir, SIN_CONEXION } from '../api'

export interface TipoReclamo {
  id: number
  codigo: string
  nombre: string
  icono: string
  color: string
}

export interface Posicion {
  latitud: number
  longitud: number
}

export interface Ejido {
  geojson: {
    features: { geometry: { type: 'Polygon'; coordinates: number[][][] } }[]
  }
  centro: Posicion
}

export interface ReclamoCreado {
  id: number
  numero: number
  estado: string
  prioridad: number
}

export interface ReclamoDetalle {
  id: number
  numero: number
  tipo: TipoReclamo
  titulo: string
  descripcion: string
  direccion: string | null
  latitud: number
  longitud: number
  estado: string
  cantidad_apoyos: number
  gravedad_promedio: number
  prioridad: number
  creado_en: string
  fotos: { tipo: string; url: string; ancho: number; alto: number }[]
  es_propio: boolean
}

export interface NuevoReclamo extends Posicion {
  tipoId: number
  titulo: string
  descripcion: string
  direccion: string
  gravedad: number
  foto: Blob
}

export function useTipos() {
  return useQuery({
    queryKey: ['tipos'],
    queryFn: ({ signal }) => pedir<TipoReclamo[]>('/tipos', { signal }),
    staleTime: Infinity,
  })
}

export function useEjido() {
  return useQuery({
    queryKey: ['ejido'],
    queryFn: ({ signal }) => pedir<Ejido>('/ejido', { signal }),
    staleTime: Infinity,
  })
}

export function useReclamo(id: number) {
  return useQuery({
    queryKey: ['reclamo', id],
    queryFn: ({ signal }) => pedir<ReclamoDetalle>(`/reclamos/${id}`, { signal }),
  })
}

/** CU-04: multipart con los datos y la foto ya reducida. */
export async function crearReclamo(datos: NuevoReclamo): Promise<ReclamoCreado> {
  const formulario = new FormData()
  formulario.append('tipo_id', String(datos.tipoId))
  formulario.append('titulo', datos.titulo)
  formulario.append('descripcion', datos.descripcion)
  if (datos.direccion) formulario.append('direccion', datos.direccion)
  formulario.append('gravedad', String(datos.gravedad))
  formulario.append('latitud', String(datos.latitud))
  formulario.append('longitud', String(datos.longitud))
  formulario.append('foto', datos.foto, 'foto.jpg')

  let respuesta: Response
  try {
    // Sin Content-Type: el navegador arma el boundary del multipart.
    respuesta = await fetch(`${API_BASE}/reclamos`, {
      method: 'POST',
      body: formulario,
      credentials: 'same-origin',
    })
  } catch {
    throw new ErrorDeApi(0, SIN_CONEXION)
  }
  const cuerpo: unknown = await respuesta.json().catch(() => null)
  if (!respuesta.ok) throw errorDesdeRespuesta(respuesta.status, cuerpo)
  return cuerpo as ReclamoCreado
}
