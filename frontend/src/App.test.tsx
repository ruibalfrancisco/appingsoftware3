import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('App', () => {
  it('muestra la versión cuando la API responde', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ status: 'ok', version: '0.1.0', commit: 'abc', ambiente: 'local' }),
            { status: 200 },
          ),
        ),
    )

    render(<App />)

    expect(screen.getByRole('heading', { level: 1, name: 'Reclamos Villa Allende' })).toBeVisible()
    expect(await screen.findByText('API conectada')).toBeVisible()
    expect(screen.getByText(/v0\.1\.0 · local/)).toBeVisible()
  })

  it('avisa cuando la API no responde', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 503 })))

    render(<App />)

    expect(await screen.findByText('No se pudo conectar con la API')).toBeVisible()
  })
})
