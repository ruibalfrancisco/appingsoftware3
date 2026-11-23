import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { vi } from 'vitest'
import { rutas } from '../rutas'

type Manejador = (cuerpo: unknown) => { status: number; json?: unknown }

/**
 * Simula la API: cada clave es "MÉTODO /ruta" (sin /api). Devuelve el mock de fetch para
 * revisar qué se envió. Una ruta sin manejador responde 404.
 */
export function simularApi(manejadores: Record<string, Manejador>) {
  const fetchFalso = vi.fn(async (url: string, init?: RequestInit) => {
    const ruta = url.replace(/^\/api/, '').split('?')[0]
    const clave = `${init?.method ?? 'GET'} ${ruta}`
    const manejador = manejadores[clave]
    const cuerpo = init?.body ? JSON.parse(String(init.body)) : undefined
    const { status, json } = manejador ? manejador(cuerpo) : { status: 404, json: {} }
    return new Response(status === 204 ? null : JSON.stringify(json ?? {}), { status })
  })
  vi.stubGlobal('fetch', fetchFalso)
  return fetchFalso
}

export const sinSesion = {
  'GET /auth/yo': () => ({ status: 401, json: { detail: 'Iniciá sesión' } }),
}
export const saludOk = {
  'GET /health': () => ({
    status: 200,
    json: { status: 'ok', version: '0.1.0', commit: 'abc', ambiente: 'local' },
  }),
}

export const ANA = {
  id: 1,
  nombre: 'Ana',
  apellido: 'Pérez',
  email: 'ana@ejemplo.com',
  rol: 'vecino',
  email_verificado: true,
}

export function renderizarEn(ruta: string) {
  const clienteQuery = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter(rutas, { initialEntries: [ruta] })
  render(
    <QueryClientProvider client={clienteQuery}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return { router, clienteQuery }
}
