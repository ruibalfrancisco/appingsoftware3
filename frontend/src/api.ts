export interface Salud {
  status: 'ok'
  version: string
  commit: string
  ambiente: string
}

// La API se sirve en el mismo dominio que la web, bajo /api: en producción la reenvía nginx
// y en desarrollo el proxy de Vite (vite.config.ts). Así la cookie de sesión es propia.
export const API_BASE = '/api'

export async function obtenerSalud(signal?: AbortSignal): Promise<Salud> {
  const respuesta = await fetch(`${API_BASE}/health`, { signal })
  if (!respuesta.ok) {
    throw new Error(`La API respondió ${respuesta.status}`)
  }
  return (await respuesta.json()) as Salud
}
