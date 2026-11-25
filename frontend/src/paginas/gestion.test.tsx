import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ANA, renderizarEn, simularApi } from '../test/utilidades'

// En jsdom no hay canvas: la reducción de la foto se prueba en el E2E.
vi.mock('../reclamos/imagen', async (original) => ({
  ...(await original<typeof import('../reclamos/imagen')>()),
  reducirFoto: vi.fn(async (archivo: File) => archivo),
}))

const OPERADORA = { ...ANA, id: 9, nombre: 'Olga', apellido: 'Operadora', rol: 'operador' }

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
const AREAS = [
  { id: 1, nombre: 'Alumbrado' },
  { id: 2, nombre: 'Obras Públicas' },
]
const hace3Dias = new Date(Date.now() - 3 * 86_400_000).toISOString()

const FILAS = [
  {
    id: 12,
    numero: 12,
    tipo: TIPOS[0],
    estado: 'EN_PROCESO',
    area: 'Obras Públicas',
    descripcion: 'Bache enorme',
    direccion: 'San Martín 100',
    latitud: -31.29,
    longitud: -64.29,
    cantidad_apoyos: 3,
    gravedad_promedio: 7,
    prioridad: 18.09,
    creado_en: hace3Dias,
    foto_url: 'https://fotos.example/a.jpg',
  },
  {
    id: 7,
    numero: 7,
    tipo: TIPOS[1],
    estado: 'PENDIENTE',
    area: null,
    descripcion: 'Apagada',
    direccion: null,
    latitud: -31.295,
    longitud: -64.296,
    cantidad_apoyos: 1,
    gravedad_promedio: 5,
    prioridad: 5,
    creado_en: hace3Dias,
    foto_url: null,
  },
]

function apiMunicipal(extra = {}) {
  return simularApi({
    'GET /auth/yo': () => ({ status: 200, json: OPERADORA }),
    'GET /tipos': () => ({ status: 200, json: TIPOS }),
    'GET /gestion/areas': () => ({ status: 200, json: AREAS }),
    'GET /gestion/reclamos': () => ({ status: 200, json: FILAS }),
    ...extra,
  })
}

function urlsPedidas(api: ReturnType<typeof simularApi>) {
  return api.mock.calls.map(([url]) => url)
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

describe('Tablero (CU-07, CU-09)', () => {
  it('muestra la cola por prioridad con sus datos y los mismos reclamos en el mapa', async () => {
    apiMunicipal()
    renderizarEn('/tablero')

    expect(await screen.findByRole('heading', { name: /2 reclamos/ })).toBeVisible()
    const [primero, segundo] = within(
      screen.getByRole('list', { name: 'Reclamos por prioridad' }),
    ).getAllByRole('listitem')
    expect(primero).toHaveTextContent('18,1')
    expect(primero).toHaveTextContent('En proceso')
    expect(primero).toHaveTextContent('San Martín 100')
    expect(primero).toHaveTextContent('3 apoyos')
    expect(primero).toHaveTextContent('hace 3 días')
    expect(primero).toHaveTextContent('Obras Públicas')
    expect(within(primero).getByRole('link')).toHaveAttribute('href', '/tablero/reclamos/12')
    expect(segundo).toHaveTextContent('Sin área')
    expect(segundo).toHaveTextContent('-31.29500, -64.29600')
    expect(screen.getByText('Olga Operadora')).toBeVisible()

    await userEvent.click(screen.getByRole('button', { name: 'Reclamo #12: Bache' }))
    const tarjeta = screen.getByRole('dialog', { name: 'Reclamo #12' })
    expect(within(tarjeta).getByRole('link', { name: /Abrir el reclamo/ })).toHaveAttribute(
      'href',
      '/tablero/reclamos/12',
    )
    await userEvent.click(within(tarjeta).getByRole('button', { name: 'Cerrar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('RF-25: los filtros viajan a la API y se limpian de una vez', async () => {
    const api = apiMunicipal()
    renderizarEn('/tablero')
    await screen.findByRole('heading', { name: /2 reclamos/ })

    await userEvent.selectOptions(await screen.findByLabelText('Tipo'), 'Luminaria rota')
    await waitFor(() => expect(urlsPedidas(api)).toContain('/api/gestion/reclamos?tipo_id=2'))
    await userEvent.selectOptions(screen.getByLabelText('Estado'), 'Todos')
    await waitFor(() =>
      expect(urlsPedidas(api)).toContain(
        '/api/gestion/reclamos?tipo_id=2&estado=PENDIENTE&estado=EN_REVISION' +
          '&estado=EN_PROCESO&estado=RESUELTO&estado=RECHAZADO',
      ),
    )

    await userEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }))

    expect(screen.getByLabelText('Tipo')).toHaveValue('')
    expect(screen.queryByRole('button', { name: 'Limpiar filtros' })).not.toBeInTheDocument()
  })

  it('CU-07 alternativo: sin resultados ofrece limpiar los filtros', async () => {
    apiMunicipal({ 'GET /gestion/reclamos': () => ({ status: 200, json: [] }) })
    renderizarEn('/tablero?estado=RECHAZADO')

    expect(await screen.findByText('No hay reclamos con estos filtros')).toBeVisible()
    expect(screen.getByText('Sin reclamos para mostrar en el mapa')).toBeVisible()
    expect(screen.getAllByRole('button', { name: 'Limpiar filtros' })).toHaveLength(2)
  })

  it('un vecino no ve el back office', async () => {
    simularApi({ 'GET /auth/yo': () => ({ status: 200, json: ANA }) })
    renderizarEn('/tablero')

    expect(await screen.findByRole('heading', { name: 'Solo personal municipal' })).toBeVisible()
  })

  it('sin sesión manda a ingresar', async () => {
    simularApi({ 'GET /auth/yo': () => ({ status: 401, json: { detail: 'Iniciá sesión' } }) })
    const { router } = renderizarEn('/tablero')

    await waitFor(() => expect(router.state.location.pathname).toBe('/ingresar'))
    expect(await screen.findByText('Ingresá con tu usuario municipal.')).toBeVisible()
  })

  it('CU-03: el personal municipal entra directo al Tablero', async () => {
    apiMunicipal({
      'GET /auth/yo': () => ({ status: 401, json: { detail: 'Iniciá sesión' } }),
      'POST /auth/ingreso': () => ({ status: 200, json: OPERADORA }),
    })
    const { router } = renderizarEn('/ingresar')

    await userEvent.type(await screen.findByLabelText('DNI o email'), '20999888')
    await userEvent.type(screen.getByLabelText('Contraseña'), 'clave-de-prueba-1')
    await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/tablero'))
  })
})

function detalle(cambios: Record<string, unknown> = {}) {
  return {
    id: 7,
    numero: 7,
    tipo: TIPOS[0],
    estado: 'PENDIENTE',
    area: null,
    descripcion: 'Ocupa medio carril',
    direccion: 'San Martín 100',
    latitud: -31.29,
    longitud: -64.29,
    cantidad_apoyos: 2,
    gravedad_promedio: 6,
    prioridad: 12,
    creado_en: '2026-11-23T13:05:00Z',
    actualizado_en: '2026-11-23T13:05:00Z',
    cerrado_en: null,
    fotos: [{ tipo: 'reporte', url: 'https://fotos.example/a.jpg', ancho: 1600, alto: 1200 }],
    historial: [
      {
        estado_anterior: null,
        estado_nuevo: 'PENDIENTE',
        comentario: null,
        creado_en: '2026-11-23T13:05:00Z',
        autor: 'Vecino',
      },
    ],
    transiciones: ['EN_REVISION', 'RECHAZADO'],
    ...cambios,
  }
}

function enviado(api: ReturnType<typeof simularApi>) {
  const [, init] = api.mock.calls.find(([url]) => url === '/api/gestion/reclamos/7/estado')!
  return init?.body as FormData
}

describe('Detalle y cambio de estado (RF-27, CU-08)', () => {
  it('muestra los datos, el historial y rechaza solo con motivo', async () => {
    const api = apiMunicipal({
      'GET /gestion/reclamos/7': () => ({ status: 200, json: detalle() }),
      'POST /gestion/reclamos/7/estado': () => ({
        status: 200,
        json: { estado: 'RECHAZADO', transiciones: [], notificados: 2 },
      }),
    })
    renderizarEn('/tablero/reclamos/7')

    expect(await screen.findByRole('heading', { name: 'Bache #7' })).toBeVisible()
    expect(screen.getByText('Prioridad').parentElement).toHaveTextContent('12,0')
    expect(screen.getByText('Área').parentElement).toHaveTextContent('Sin asignar')
    const historial = screen.getByRole('region', { name: 'Historial' })
    expect(historial).toHaveTextContent('Reclamo cargado')
    expect(historial).toHaveTextContent('Vecino')

    await userEvent.click(screen.getByRole('button', { name: 'Rechazar' }))
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar: Rechazar' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Escribí el motivo del rechazo')
    expect(urlsPedidas(api)).not.toContain('/api/gestion/reclamos/7/estado')

    await userEvent.type(screen.getByLabelText('Motivo del rechazo'), 'Es una calle privada')
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar: Rechazar' }))

    expect(await screen.findByText(/Le avisamos a 2 vecinos/)).toBeVisible()
    const datos = enviado(api)
    expect(datos.get('estado')).toBe('RECHAZADO')
    expect(datos.get('comentario')).toBe('Es una calle privada')
  })

  it('pasar a En proceso exige el área responsable', async () => {
    const api = apiMunicipal({
      'GET /gestion/reclamos/7': () => ({
        status: 200,
        json: detalle({ estado: 'EN_REVISION', transiciones: ['EN_PROCESO', 'RECHAZADO'] }),
      }),
      'POST /gestion/reclamos/7/estado': () => ({
        status: 200,
        json: { estado: 'EN_PROCESO', transiciones: ['RESUELTO'], notificados: 1 },
      }),
    })
    renderizarEn('/tablero/reclamos/7')

    await userEvent.click(await screen.findByRole('button', { name: 'Pasar a En proceso' }))
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar: Pasar a En proceso' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Elegí el área responsable')

    await userEvent.selectOptions(screen.getByLabelText('Área responsable'), 'Obras Públicas')
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar: Pasar a En proceso' }))

    expect(await screen.findByText(/Le avisamos a 1 vecino\./)).toBeVisible()
    expect(enviado(api).get('area_id')).toBe('2')
  })

  it('RF-30: resolver pide qué se hizo y manda la foto del después', async () => {
    const api = apiMunicipal({
      'GET /gestion/reclamos/7': () => ({
        status: 200,
        json: detalle({ estado: 'EN_PROCESO', transiciones: ['RESUELTO'] }),
      }),
      'POST /gestion/reclamos/7/estado': () => ({
        status: 200,
        json: { estado: 'RESUELTO', transiciones: [], notificados: 2 },
      }),
    })
    renderizarEn('/tablero/reclamos/7')

    await userEvent.click(await screen.findByRole('button', { name: 'Resolver' }))
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar: Resolver' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Contá qué se hizo')

    await userEvent.upload(
      screen.getByLabelText(/Elegir la foto del después/),
      new File(['jpg'], 'despues.jpg', { type: 'image/jpeg' }),
    )
    expect(await screen.findByRole('img', { name: 'Foto del después' })).toBeVisible()
    await userEvent.type(screen.getByLabelText('Qué se hizo'), 'Bacheado')
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar: Resolver' }))

    expect(await screen.findByText(/pasó a Resuelto/)).toBeVisible()
    const datos = enviado(api)
    expect(datos.get('comentario')).toBe('Bacheado')
    expect(datos.get('foto')).toBeInstanceOf(Blob)
  })

  it('si el backend rechaza el cambio, muestra el motivo', async () => {
    apiMunicipal({
      'GET /gestion/reclamos/7': () => ({ status: 200, json: detalle() }),
      'POST /gestion/reclamos/7/estado': () => ({
        status: 409,
        json: { detail: 'No se puede pasar de PENDIENTE a EN_REVISION' },
      }),
    })
    renderizarEn('/tablero/reclamos/7')

    await userEvent.click(await screen.findByRole('button', { name: 'Pasar a En revisión' }))
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar: Pasar a En revisión' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('No se puede pasar')
  })

  it('un reclamo cerrado no ofrece cambios y muestra la foto del después', async () => {
    apiMunicipal({
      'GET /gestion/reclamos/7': () => ({
        status: 200,
        json: detalle({
          estado: 'RESUELTO',
          transiciones: [],
          area: { id: 2, nombre: 'Obras Públicas' },
          cerrado_en: '2026-11-24T18:00:00Z',
          fotos: [
            { tipo: 'reporte', url: 'https://fotos.example/a.jpg', ancho: 1600, alto: 1200 },
            { tipo: 'resolucion', url: 'https://fotos.example/b.jpg', ancho: 1600, alto: 1200 },
          ],
        }),
      }),
    })
    renderizarEn('/tablero/reclamos/7')

    expect(
      await screen.findByText(/El reclamo está cerrado \(Resuelto el 24\/11\/2026/),
    ).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Resolver' })).not.toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Foto del después' })).toHaveAttribute(
      'src',
      'https://fotos.example/b.jpg',
    )
  })

  it('reclamo inexistente', async () => {
    apiMunicipal({
      'GET /gestion/reclamos/7': () => ({ status: 404, json: { detail: 'No existe ese reclamo' } }),
    })
    renderizarEn('/tablero/reclamos/7')

    expect(await screen.findByRole('alert')).toHaveTextContent('No existe ese reclamo')
  })
})
