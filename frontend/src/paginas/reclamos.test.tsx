import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ANA, renderizarEn, simularApi } from '../test/utilidades'

// En jsdom no hay canvas: la reducción de la foto se prueba en el E2E.
vi.mock('../reclamos/imagen', async (original) => ({
  ...(await original<typeof import('../reclamos/imagen')>()),
  reducirFoto: vi.fn(async (archivo: File) => archivo),
}))

const ANILLO = [
  [-64.3, -31.3],
  [-64.28, -31.3],
  [-64.28, -31.28],
  [-64.3, -31.28],
  [-64.3, -31.3],
]
const ADENTRO = { latitude: -31.29, longitude: -64.29 }
const AFUERA = { latitude: -31.4167, longitude: -64.1833 }

const TIPOS = [
  { id: 1, codigo: 'bache', nombre: 'Bache', icono: 'construction', color: '#B45309' },
  {
    id: 2,
    codigo: 'luminaria',
    nombre: 'Luminaria rota',
    icono: 'lightbulb-off',
    color: '#7C3AED',
  },
]

function apiDeReclamos(extra = {}) {
  return simularApi({
    'GET /auth/yo': () => ({ status: 200, json: ANA }),
    'GET /tipos': () => ({ status: 200, json: TIPOS }),
    'GET /ejido': () => ({
      status: 200,
      json: {
        geojson: { features: [{ geometry: { type: 'Polygon', coordinates: [ANILLO] } }] },
        centro: { latitud: -31.29, longitud: -64.29 },
      },
    }),
    ...extra,
  })
}

function simularGps(coords: { latitude: number; longitude: number } | 'denegado') {
  vi.stubGlobal('navigator', {
    ...navigator,
    geolocation: {
      getCurrentPosition: (ok: PositionCallback, error: PositionErrorCallback) =>
        coords === 'denegado'
          ? error({ code: 1, message: 'denegado' } as GeolocationPositionError)
          : ok({ coords } as GeolocationPosition),
    },
  })
}

beforeEach(() => {
  vi.stubGlobal(
    'URL',
    Object.assign(URL, { createObjectURL: () => 'blob:foto', revokeObjectURL: () => {} }),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

async function hastaLaUbicacion() {
  await userEvent.click(await screen.findByRole('button', { name: /Bache/ }))
  const galeria = screen.getByLabelText(/Elegir de la galería/)
  await userEvent.upload(galeria, new File(['jpg'], 'bache.jpg', { type: 'image/jpeg' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Usar esta foto' }))
}

describe('Nuevo reclamo (CU-04)', () => {
  it('recorrido completo: tipo, foto, ubicación, detalles, resumen y número', async () => {
    simularGps(ADENTRO)
    const api = apiDeReclamos({
      'POST /reclamos': () => ({
        status: 201,
        json: { id: 7, numero: 7, estado: 'PENDIENTE', prioridad: 8 },
      }),
    })
    renderizarEn('/reclamos/nuevo')

    expect(await screen.findByText('Paso 1 de 5 · Tipo')).toBeVisible()
    await hastaLaUbicacion()
    expect(await screen.findByText('Paso 3 de 5 · Ubicación')).toBeVisible()
    await userEvent.click(await screen.findByRole('button', { name: 'Confirmar ubicación' }))

    await userEvent.type(await screen.findByLabelText('Título'), 'Bache en la esquina')
    await userEvent.click(screen.getByRole('button', { name: 'Revisar' }))

    const resumen = await screen.findByRole('region', { name: 'Resumen del reclamo' })
    expect(resumen).toHaveTextContent('Bache en la esquina')
    expect(resumen).toHaveTextContent('5 · Moderado')
    await userEvent.click(screen.getByRole('button', { name: 'Enviar reclamo' }))

    expect(await screen.findByRole('heading', { name: '¡Reclamo enviado!' })).toBeVisible()
    expect(screen.getByText('#7')).toBeVisible()
    const [, init] = api.mock.calls.find(([url]) => url === '/api/reclamos')!
    const enviado = init?.body as FormData
    expect(
      Object.fromEntries(
        ['tipo_id', 'titulo', 'gravedad', 'latitud'].map((k) => [k, enviado.get(k)]),
      ),
    ).toEqual({
      tipo_id: '1',
      titulo: 'Bache en la esquina',
      gravedad: '5',
      latitud: '-31.29',
    })
    expect(enviado.get('foto')).toBeInstanceOf(Blob)
  })

  it('UT-09 sin foto no avanza', async () => {
    simularGps(ADENTRO)
    apiDeReclamos()
    renderizarEn('/reclamos/nuevo')

    await userEvent.click(await screen.findByRole('button', { name: /Bache/ }))

    expect(screen.queryByRole('button', { name: 'Usar esta foto' })).not.toBeInTheDocument()
    expect(screen.getByText('Paso 2 de 5 · Foto')).toBeVisible()
  })

  it('UT-09 y CU-04 4a: con el pin fuera de Villa Allende no se puede confirmar', async () => {
    simularGps(AFUERA)
    apiDeReclamos()
    renderizarEn('/reclamos/nuevo')

    await hastaLaUbicacion()

    expect(await screen.findByRole('alert')).toHaveTextContent('fuera de Villa Allende')
    expect(screen.getByRole('button', { name: 'Confirmar ubicación' })).toBeDisabled()
  })

  it('CU-04 3a: sin permiso de ubicación abre en Villa Allende y se puede mover el pin', async () => {
    simularGps('denegado')
    apiDeReclamos()
    renderizarEn('/reclamos/nuevo')

    await hastaLaUbicacion()

    expect(await screen.findByText(/No pudimos usar tu ubicación/)).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: 'Mover al norte' }))
    expect(screen.getByText(/-31\.2897/)).toBeVisible()
    expect(screen.getByRole('button', { name: 'Confirmar ubicación' })).toBeEnabled()
  })

  it('una foto que no es JPG, PNG o WEBP se rechaza en el momento', async () => {
    simularGps(ADENTRO)
    apiDeReclamos()
    renderizarEn('/reclamos/nuevo')
    await userEvent.click(await screen.findByRole('button', { name: /Bache/ }))

    await userEvent.upload(
      screen.getByLabelText(/Elegir de la galería/),
      new File(['gif'], 'animada.gif', { type: 'image/gif' }),
      { applyAccept: false },
    )

    expect(await screen.findByRole('alert')).toHaveTextContent('JPG, PNG o WEBP')
  })

  it('CU-04 8b: si el backend rechaza, muestra el motivo sin perder lo cargado', async () => {
    simularGps(ADENTRO)
    apiDeReclamos({
      'POST /reclamos': () => ({
        status: 429,
        json: { detail: 'Llegaste al máximo de 5 reclamos por día.' },
      }),
    })
    renderizarEn('/reclamos/nuevo')
    await hastaLaUbicacion()
    await userEvent.click(await screen.findByRole('button', { name: 'Confirmar ubicación' }))
    await userEvent.type(await screen.findByLabelText('Título'), 'Otro bache')
    await userEvent.click(screen.getByRole('button', { name: 'Revisar' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Enviar reclamo' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('máximo de 5 reclamos')
    expect(screen.getByRole('region', { name: 'Resumen del reclamo' })).toHaveTextContent(
      'Otro bache',
    )
  })

  it('sin sesión manda a ingresar', async () => {
    simularApi({ 'GET /auth/yo': () => ({ status: 401, json: { detail: 'Iniciá sesión' } }) })
    const { router } = renderizarEn('/reclamos/nuevo')

    await waitFor(() => expect(router.state.location.pathname).toBe('/ingresar'))
    expect(await screen.findByText('Ingresá para cargar un reclamo.')).toBeVisible()
  })
})

describe('Detalle del reclamo', () => {
  it('muestra foto, tipo, estado y fecha en formato argentino', async () => {
    simularApi({
      'GET /reclamos/7': () => ({
        status: 200,
        json: {
          id: 7,
          numero: 7,
          tipo: TIPOS[0],
          titulo: 'Bache en la esquina',
          descripcion: 'Profundo',
          direccion: 'San Martín 100',
          latitud: -31.29,
          longitud: -64.29,
          estado: 'PENDIENTE',
          cantidad_apoyos: 1,
          gravedad_promedio: 8,
          prioridad: 8,
          creado_en: '2026-11-23T13:05:00Z',
          fotos: [{ tipo: 'reporte', url: 'https://fotos.example/a.jpg', ancho: 1600, alto: 1200 }],
          es_propio: true,
        },
      }),
    })
    renderizarEn('/reclamos/7')

    expect(await screen.findByRole('heading', { name: 'Bache en la esquina' })).toBeVisible()
    expect(screen.getByText('Reclamo #7')).toBeVisible()
    expect(screen.getByText('Pendiente')).toBeVisible()
    expect(screen.getByText('8.0 · Grave')).toBeVisible()
    // RNF-14: dd/mm/aaaa y 24 h, en la hora de Córdoba (13:05 UTC = 10:05).
    expect(screen.getByText('23/11/2026, 10:05')).toBeVisible()
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://fotos.example/a.jpg')
  })

  it('reclamo inexistente', async () => {
    simularApi({
      'GET /reclamos/99': () => ({ status: 404, json: { detail: 'No existe ese reclamo' } }),
    })
    renderizarEn('/reclamos/99')
    expect(await screen.findByRole('alert')).toHaveTextContent('No existe ese reclamo')
  })
})

describe('Dirección del pin (RF-10)', () => {
  it('aparece sobre el mapa y completa el campo del paso siguiente', async () => {
    simularGps(ADENTRO)
    apiDeReclamos({
      'GET /direccion': () => ({
        status: 200,
        json: { direccion: 'Rivera Indarte 101, Villa Allende Centro' },
      }),
    })
    renderizarEn('/reclamos/nuevo')
    await hastaLaUbicacion()

    expect(await screen.findByText('Rivera Indarte 101, Villa Allende Centro')).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar ubicación' }))

    expect(await screen.findByLabelText('Dirección o referencia (opcional)')).toHaveValue(
      'Rivera Indarte 101, Villa Allende Centro',
    )
  })
})
