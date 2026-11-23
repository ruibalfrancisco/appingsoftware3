// La API se sirve en el mismo dominio que la web, bajo /api: en producción la reenvía nginx
// y en desarrollo el proxy de Vite (vite.config.ts). Así la cookie de sesión es propia.
export const API_BASE = '/api'

export interface Salud {
  status: 'ok'
  version: string
  commit: string
  ambiente: string
}

/** Error de la API con el mensaje listo para mostrar y, si los hay, errores por campo. */
export class ErrorDeApi extends Error {
  readonly status: number
  readonly campos: Record<string, string>

  constructor(status: number, mensaje: string, campos: Record<string, string> = {}) {
    super(mensaje)
    this.name = 'ErrorDeApi'
    this.status = status
    this.campos = campos
  }
}

interface ErrorDeValidacion {
  loc: (string | number)[]
  msg: string
}

export const SIN_CONEXION = 'No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.'
export const ERROR_GENERICO = 'Algo salió mal. Intentá de nuevo en unos minutos.'

export function errorDesdeRespuesta(status: number, cuerpo: unknown): ErrorDeApi {
  const detalle = (cuerpo as { detail?: unknown } | null)?.detail
  if (typeof detalle === 'string') {
    return new ErrorDeApi(status, detalle)
  }
  if (Array.isArray(detalle)) {
    // 422 de FastAPI: [{ loc: ['body', 'dni'], msg: 'Value error, El DNI ...' }]
    const campos: Record<string, string> = {}
    for (const error of detalle as ErrorDeValidacion[]) {
      const campo = String(error.loc.at(-1) ?? '')
      campos[campo] ??= error.msg.replace(/^Value error, /, '')
    }
    return new ErrorDeApi(status, 'Revisá los datos marcados.', campos)
  }
  return new ErrorDeApi(status, ERROR_GENERICO)
}

interface OpcionesDePedido {
  metodo?: 'GET' | 'POST'
  cuerpo?: unknown
  signal?: AbortSignal
}

export async function pedir<T>(ruta: string, opciones: OpcionesDePedido = {}): Promise<T> {
  const { metodo = 'GET', cuerpo, signal } = opciones
  let respuesta: Response
  try {
    respuesta = await fetch(`${API_BASE}${ruta}`, {
      method: metodo,
      headers: cuerpo === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
      credentials: 'same-origin',
      signal,
    })
  } catch (error) {
    if (signal?.aborted) throw error
    throw new ErrorDeApi(0, SIN_CONEXION)
  }
  if (respuesta.status === 204) {
    return undefined as T
  }
  const datos: unknown = await respuesta.json().catch(() => null)
  if (!respuesta.ok) {
    throw errorDesdeRespuesta(respuesta.status, datos)
  }
  return datos as T
}

export function obtenerSalud(signal?: AbortSignal): Promise<Salud> {
  return pedir<Salud>('/health', { signal })
}
