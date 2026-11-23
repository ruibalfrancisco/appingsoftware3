import { fireEvent, screen, waitFor, within } from '@testing-library/react'
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
    // Por defecto no hay reclamos parecidos (RN-01).
    'GET /reclamos/similares': () => ({ status: 200, json: [] }),
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

    expect(screen.queryByLabelText(/Título/)).not.toBeInTheDocument()
    await userEvent.type(await screen.findByLabelText('Descripción'), 'Ocupa medio carril')
    await userEvent.click(screen.getByRole('button', { name: 'Revisar' }))

    const resumen = await screen.findByRole('region', { name: 'Resumen del reclamo' })
    expect(resumen).toHaveTextContent('Bache')
    expect(resumen).toHaveTextContent('Ocupa medio carril')
    expect(resumen).toHaveTextContent('5 · Moderado')
    await userEvent.click(screen.getByRole('button', { name: 'Enviar reclamo' }))

    expect(await screen.findByRole('heading', { name: '¡Reclamo enviado!' })).toBeVisible()
    expect(screen.getByText('#7')).toBeVisible()
    const [, init] = api.mock.calls.find(([url]) => url === '/api/reclamos')!
    const enviado = init?.body as FormData
    expect(
      Object.fromEntries(
        ['tipo_id', 'descripcion', 'gravedad', 'latitud'].map((k) => [k, enviado.get(k)]),
      ),
    ).toEqual({
      tipo_id: '1',
      descripcion: 'Ocupa medio carril',
      gravedad: '5',
      latitud: '-31.29',
    })
    expect(enviado.get('foto')).toBeInstanceOf(Blob)
    expect(enviado.has('titulo')).toBe(false)
  })

  it('RF-14 sin descripción no avanza al resumen', async () => {
    simularGps(ADENTRO)
    apiDeReclamos()
    renderizarEn('/reclamos/nuevo')
    await hastaLaUbicacion()
    await userEvent.click(await screen.findByRole('button', { name: 'Confirmar ubicación' }))

    await userEvent.type(await screen.findByLabelText('Descripción'), '   ')
    await userEvent.click(screen.getByRole('button', { name: 'Revisar' }))

    expect(await screen.findByText(/Escribí qué pasa/)).toBeVisible()
    expect(screen.getByLabelText('Descripción')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.queryByRole('region', { name: 'Resumen del reclamo' })).not.toBeInTheDocument()
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
    await userEvent.type(await screen.findByLabelText('Descripción'), 'Otro bache')
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
  it('muestra foto, tipo, estado, ubicación en el mapa y fecha en formato argentino', async () => {
    simularApi({
      'GET /reclamos/7': () => ({
        status: 200,
        json: {
          id: 7,
          numero: 7,
          tipo: TIPOS[0],
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

    expect(await screen.findByRole('heading', { name: 'Bache' })).toBeVisible()
    expect(screen.getByText('Reclamo #7')).toBeVisible()
    expect(screen.getByText('Pendiente')).toBeVisible()
    expect(screen.getByText('8.0 · Grave')).toBeVisible()
    // RNF-14: dd/mm/aaaa y 24 h, en la hora de Córdoba (13:05 UTC = 10:05).
    expect(screen.getByText('23/11/2026, 10:05')).toBeVisible()
    expect(screen.getByRole('img', { name: 'Foto del reclamo: Bache' })).toHaveAttribute(
      'src',
      'https://fotos.example/a.jpg',
    )
    const ubicacion = screen.getByRole('region', { name: 'Ubicación' })
    expect(ubicacion).toHaveTextContent('San Martín 100')
    expect(within(ubicacion).getByRole('img', { name: /Mapa con la ubicación/ })).toBeVisible()
    expect(ubicacion).toHaveTextContent('-31.29000, -64.29000')
    // Es propio: "Volver" lleva a la lista de sus reclamos.
    expect(screen.getByRole('link', { name: '← Volver' })).toHaveAttribute('href', '/mis-reclamos')
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

describe('Mis reclamos', () => {
  const MIOS = [
    {
      id: 9,
      numero: 9,
      tipo: TIPOS[1],
      descripcion: 'Apagada hace una semana',
      direccion: null,
      latitud: -31.295,
      longitud: -64.296,
      estado: 'EN_PROCESO',
      cantidad_apoyos: 3,
      creado_en: '2026-11-24T02:30:00Z',
      foto_url: 'https://fotos.example/b.jpg',
    },
    {
      id: 7,
      numero: 7,
      tipo: TIPOS[0],
      descripcion: 'Profundo',
      direccion: 'San Martín 100, Villa Allende Centro',
      latitud: -31.29,
      longitud: -64.29,
      estado: 'PENDIENTE',
      cantidad_apoyos: 1,
      creado_en: '2026-11-20T13:05:00Z',
      foto_url: null,
    },
  ]

  it('lista cada reclamo con su ubicación, estado y fecha, y los muestra en el mapa', async () => {
    simularApi({
      'GET /auth/yo': () => ({ status: 200, json: ANA }),
      'GET /reclamos/mios': () => ({ status: 200, json: MIOS }),
    })
    renderizarEn('/mis-reclamos')

    expect(await screen.findByRole('heading', { name: 'Mis reclamos' })).toBeVisible()
    expect(await screen.findByText('Tenés 2 reclamos cargados.')).toBeVisible()
    const [luminaria, bache] = within(
      screen.getByRole('list', { name: 'Tus reclamos' }),
    ).getAllByRole('listitem')
    expect(luminaria).toHaveTextContent('Luminaria rota')
    expect(luminaria).toHaveTextContent('-31.29500, -64.29600') // sin dirección: coordenadas
    expect(luminaria).toHaveTextContent('En proceso')
    expect(luminaria).toHaveTextContent('#9 · 23/11/2026') // el día de Córdoba
    expect(bache).toHaveTextContent('San Martín 100, Villa Allende Centro')
    expect(bache).toHaveTextContent('Pendiente')
    expect(within(bache).getByRole('link')).toHaveAttribute('href', '/reclamos/7')
    expect(screen.getByRole('button', { name: 'Reclamo #9: Luminaria rota' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Reclamo #7: Bache' })).toBeVisible()
  })

  it('tocar un pin del mapa abre ese reclamo', async () => {
    simularApi({
      'GET /auth/yo': () => ({ status: 200, json: ANA }),
      'GET /reclamos/mios': () => ({ status: 200, json: MIOS }),
    })
    const { router } = renderizarEn('/mis-reclamos')

    await userEvent.click(await screen.findByRole('button', { name: 'Reclamo #7: Bache' }))

    expect(router.state.location.pathname).toBe('/reclamos/7')
  })

  it('sin reclamos invita a cargar el primero', async () => {
    simularApi({
      'GET /auth/yo': () => ({ status: 200, json: ANA }),
      'GET /reclamos/mios': () => ({ status: 200, json: [] }),
    })
    renderizarEn('/mis-reclamos')

    expect(await screen.findByText('Todavía no cargaste reclamos')).toBeVisible()
    expect(screen.getByRole('link', { name: 'Nuevo reclamo' })).toHaveAttribute(
      'href',
      '/reclamos/nuevo',
    )
    expect(screen.queryByRole('list', { name: 'Tus reclamos' })).not.toBeInTheDocument()
  })

  it('si la API falla, lo dice', async () => {
    simularApi({
      'GET /auth/yo': () => ({ status: 200, json: ANA }),
      'GET /reclamos/mios': () => ({ status: 500, json: { detail: 'Algo salió mal' } }),
    })
    renderizarEn('/mis-reclamos')

    expect(await screen.findByRole('alert')).toBeVisible()
  })

  it('sin sesión manda a ingresar', async () => {
    simularApi({ 'GET /auth/yo': () => ({ status: 401, json: { detail: 'Iniciá sesión' } }) })
    const { router } = renderizarEn('/mis-reclamos')

    await waitFor(() => expect(router.state.location.pathname).toBe('/ingresar'))
    expect(await screen.findByText('Ingresá para ver tus reclamos.')).toBeVisible()
  })
})

describe('Similares y "Yo también lo vi" (CU-05)', () => {
  const SIMILARES = [
    {
      id: 12,
      numero: 12,
      tipo: TIPOS[0],
      descripcion: 'Bache enorme en la esquina',
      direccion: 'San Martín 100',
      distancia_m: 8,
      estado: 'PENDIENTE',
      cantidad_apoyos: 2,
      foto_url: 'https://fotos.example/s.jpg',
      es_propio: false,
      ya_apoyado: false,
    },
    {
      id: 15,
      numero: 15,
      tipo: TIPOS[0],
      descripcion: 'El que cargué ayer',
      direccion: null,
      distancia_m: 0,
      estado: 'EN_REVISION',
      cantidad_apoyos: 1,
      foto_url: null,
      es_propio: true,
      ya_apoyado: false,
    },
    {
      id: 16,
      numero: 16,
      tipo: TIPOS[0],
      descripcion: 'Otro bache',
      direccion: null,
      distancia_m: 40,
      estado: 'PENDIENTE',
      cantidad_apoyos: 4,
      foto_url: null,
      es_propio: false,
      ya_apoyado: true,
    },
  ]

  async function hastaLaHoja(extra = {}) {
    simularGps(ADENTRO)
    const api = apiDeReclamos({
      'GET /reclamos/similares': () => ({ status: 200, json: SIMILARES }),
      ...extra,
    })
    renderizarEn('/reclamos/nuevo')
    await hastaLaUbicacion()
    await userEvent.click(await screen.findByRole('button', { name: 'Confirmar ubicación' }))
    const hoja = await screen.findByRole('dialog', { name: '¿Es alguno de estos?' })
    return { api, hoja }
  }

  it('RN-01: al confirmar la ubicación muestra los parecidos y se apoya uno con su gravedad', async () => {
    const { api, hoja } = await hastaLaHoja({
      'POST /reclamos/12/apoyos': () => ({
        status: 201,
        json: { numero: 12, cantidad_apoyos: 3, gravedad_promedio: 7, prioridad: 18.1 },
      }),
    })

    const [busqueda] = api.mock.calls.find(([url]) => url.startsWith('/api/reclamos/similares'))!
    expect(busqueda).toContain('tipo_id=1')
    expect(busqueda).toContain('latitud=-31.29')
    expect(hoja).toHaveTextContent('Ya hay 3 reclamos del mismo tipo a menos de 50 m')
    const [cercano, propio, apoyado] = within(hoja).getAllByRole('article')
    expect(cercano).toHaveTextContent('Bache enorme en la esquina')
    expect(cercano).toHaveTextContent('A 8 m · San Martín 100')
    expect(cercano).toHaveTextContent('2 apoyos')
    expect(propio).toHaveTextContent('En el mismo lugar')
    expect(propio).toHaveTextContent('Es tuyo')
    expect(within(propio).queryByRole('button')).not.toBeInTheDocument()
    expect(apoyado).toHaveTextContent('Ya lo apoyaste')

    await userEvent.click(within(cercano).getByRole('button', { name: 'Yo también lo vi' }))
    fireEvent.change(within(cercano).getByRole('slider'), { target: { value: '9' } })
    expect(cercano).toHaveTextContent('9 · Urgente')
    await userEvent.click(within(cercano).getByRole('button', { name: 'Sumar mi apoyo' }))

    expect(
      await screen.findByRole('heading', { name: '¡Gracias por sumar tu apoyo!' }),
    ).toBeVisible()
    expect(screen.getByRole('main')).toHaveTextContent('3 apoyos')
    expect(screen.getByText('en el reclamo #12')).toBeVisible()
    expect(screen.getByRole('link', { name: 'Ver el reclamo' })).toHaveAttribute(
      'href',
      '/reclamos/12',
    )
    const [, init] = api.mock.calls.find(([url]) => url === '/api/reclamos/12/apoyos')!
    expect(JSON.parse(init?.body as string)).toEqual({ gravedad: 9 })
    // CU-05: se apoya el existente; no se crea un reclamo nuevo ni se sube la foto.
    expect(api.mock.calls.some(([url]) => url === '/api/reclamos')).toBe(false)
  })

  it('RF-13: "No es ninguno" sigue con un reclamo nuevo', async () => {
    await hastaLaHoja()

    await userEvent.click(screen.getByRole('button', { name: /No es ninguno/ }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(await screen.findByLabelText('Descripción')).toBeVisible()
    expect(screen.getByText('Paso 4 de 5 · Detalles')).toBeVisible()
  })

  it('Escape cierra la hoja y vuelve al mapa para corregir el pin', async () => {
    await hastaLaHoja()

    await userEvent.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('Paso 3 de 5 · Ubicación')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Confirmar ubicación' })).toBeEnabled()
  })

  it('CU-05 4a: si el apoyo no se puede sumar, lo explica en la tarjeta', async () => {
    const { hoja } = await hastaLaHoja({
      'POST /reclamos/12/apoyos': () => ({
        status: 409,
        json: { detail: 'Ya apoyaste este reclamo' },
      }),
    })
    const [cercano] = within(hoja).getAllByRole('article')

    await userEvent.click(within(cercano).getByRole('button', { name: 'Yo también lo vi' }))
    await userEvent.click(within(cercano).getByRole('button', { name: 'Sumar mi apoyo' }))

    expect(await within(cercano).findByRole('alert')).toHaveTextContent('Ya apoyaste este reclamo')
    expect(screen.getByRole('dialog')).toBeVisible()
  })

  it('si la búsqueda de parecidos falla, la carga sigue igual', async () => {
    simularGps(ADENTRO)
    apiDeReclamos({ 'GET /reclamos/similares': () => ({ status: 500, json: {} }) })
    renderizarEn('/reclamos/nuevo')
    await hastaLaUbicacion()

    await userEvent.click(await screen.findByRole('button', { name: 'Confirmar ubicación' }))

    expect(await screen.findByLabelText('Descripción')).toBeVisible()
  })
})
