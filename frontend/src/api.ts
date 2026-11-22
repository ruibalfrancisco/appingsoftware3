export interface Salud {
  status: 'ok'
  version: string
  commit: string
  ambiente: string
}

const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000').replace(/\/$/, '')

export async function obtenerSalud(signal?: AbortSignal): Promise<Salud> {
  const respuesta = await fetch(`${API_URL}/health`, { signal })
  if (!respuesta.ok) {
    throw new Error(`La API respondió ${respuesta.status}`)
  }
  return (await respuesta.json()) as Salud
}
