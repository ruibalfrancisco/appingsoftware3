import { useQuery } from '@tanstack/react-query'
import { enviarFormulario, pedir } from '../api'
import { useValorEstable } from '../hooks'

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

export interface Foto {
  tipo: 'reporte' | 'resolucion'
  url: string
  ancho: number
  alto: number
}

/** Un cambio de estado; `autor` solo viene en el back office. */
export interface EntradaDeHistorial {
  estado_anterior: string | null
  estado_nuevo: string
  comentario: string | null
  creado_en: string
  autor?: string
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
  descripcion: string
  direccion: string | null
  latitud: number
  longitud: number
  estado: string
  cantidad_apoyos: number
  gravedad_promedio: number
  prioridad: number
  creado_en: string
  fotos: Foto[]
  area: string | null
  historial: EntradaDeHistorial[]
  es_propio: boolean
}

/** Una fila de "Mis reclamos". */
export interface ReclamoResumen {
  id: number
  numero: number
  tipo: TipoReclamo
  descripcion: string
  direccion: string | null
  latitud: number
  longitud: number
  estado: string
  cantidad_apoyos: number
  creado_en: string
  foto_url: string | null
}

export interface NuevoReclamo extends Posicion {
  tipoId: number
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

/** Un reclamo parecido al que se está cargando (RN-01). */
export interface ReclamoSimilar {
  id: number
  numero: number
  tipo: TipoReclamo
  descripcion: string
  direccion: string | null
  distancia_m: number
  estado: string
  cantidad_apoyos: number
  foto_url: string | null
  es_propio: boolean
  ya_apoyado: boolean
}

export interface ApoyoRegistrado {
  numero: number
  cantidad_apoyos: number
  gravedad_promedio: number
  prioridad: number
}

/** RN-01: abiertos del mismo tipo a 50 m o menos, del más cercano al más lejano. */
export function buscarSimilares(tipoId: number, posicion: Posicion) {
  const consulta = new URLSearchParams({
    tipo_id: String(tipoId),
    latitud: String(posicion.latitud),
    longitud: String(posicion.longitud),
  })
  return pedir<ReclamoSimilar[]>(`/reclamos/similares?${consulta}`)
}

/** CU-05 "Yo también lo vi". */
export function apoyarReclamo(id: number, gravedad: number) {
  return pedir<ApoyoRegistrado>(`/reclamos/${id}/apoyos`, { metodo: 'POST', cuerpo: { gravedad } })
}

export const CLAVE_MIS_RECLAMOS = ['reclamos', 'mios'] as const

/** Los reclamos que cargó el vecino, del más nuevo al más viejo. */
export function useMisReclamos(habilitada: boolean) {
  return useQuery({
    queryKey: CLAVE_MIS_RECLAMOS,
    queryFn: ({ signal }) => pedir<ReclamoResumen[]>('/reclamos/mios', { signal }),
    enabled: habilitada,
  })
}

/** CU-04: multipart con los datos y la foto ya reducida. */
export async function crearReclamo(datos: NuevoReclamo): Promise<ReclamoCreado> {
  const formulario = new FormData()
  formulario.append('tipo_id', String(datos.tipoId))
  formulario.append('descripcion', datos.descripcion)
  if (datos.direccion) formulario.append('direccion', datos.direccion)
  formulario.append('gravedad', String(datos.gravedad))
  formulario.append('latitud', String(datos.latitud))
  formulario.append('longitud', String(datos.longitud))
  formulario.append('foto', datos.foto, 'foto.jpg')
  return enviarFormulario<ReclamoCreado>('/reclamos', formulario)
}

/**
 * RF-10: dirección aproximada del pin, cuando el mapa queda quieto. La busca el backend en
 * OpenStreetMap; si no la encuentra, el vecino la escribe a mano en el paso siguiente.
 */
export function useDireccion(posicion: Posicion | undefined, habilitada: boolean) {
  const estable = useValorEstable(posicion, 700)
  return useQuery({
    queryKey: ['direccion', estable?.latitud.toFixed(4), estable?.longitud.toFixed(4)],
    queryFn: async ({ signal }) => {
      const { latitud, longitud } = estable!
      const consulta = new URLSearchParams({ latitud: String(latitud), longitud: String(longitud) })
      const { direccion } = await pedir<{ direccion: string | null }>(`/direccion?${consulta}`, {
        signal,
      })
      return direccion
    },
    enabled: habilitada && estable !== undefined,
    staleTime: Infinity,
    retry: false,
  })
}
