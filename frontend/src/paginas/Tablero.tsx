import { List, Map as IconoMapa, MapPin, Users, X } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Alerta } from '../componentes/ui'
import {
  TODOS_LOS_ESTADOS,
  useAreas,
  useTablero,
  type Filtros,
  type ReclamoEnTablero,
} from '../gestion/api'
import MarcoMunicipal from '../gestion/MarcoMunicipal'
import { useTipos } from '../reclamos/api'
import { EstadoBadge } from '../reclamos/EstadoBadge'
import { ESTADOS, colorDeEstado, nombreDeEstado } from '../reclamos/estados'
import { hace, textoDeUbicacion } from '../reclamos/formato'
import IconoTipo from '../reclamos/IconoTipo'
import MapaDeReclamos from '../reclamos/mapa/MapaDeReclamos'

const CLAVES = ['tipo', 'estado', 'area', 'desde', 'hasta'] as const

const decimal = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

function BarraDeFiltros({
  filtros,
  onCambio,
  onLimpiar,
}: {
  filtros: Filtros
  onCambio: (clave: keyof Filtros, valor: string) => void
  onLimpiar: () => void
}) {
  const tipos = useTipos()
  const areas = useAreas()
  const campo =
    'h-10 w-full rounded-tarjeta border border-slate-300 bg-superficie px-2 text-[15px] outline-none focus:border-primario focus:ring-2 focus:ring-primario/30'
  const etiqueta = 'flex flex-col gap-1 text-[13px] font-semibold text-texto-2'
  const hayFiltros = CLAVES.some((clave) => filtros[clave])

  return (
    <form
      aria-label="Filtros"
      onSubmit={(e) => e.preventDefault()}
      className="grid grid-cols-2 gap-3 rounded-tarjeta bg-superficie p-3 shadow-sm ring-1 ring-slate-200 sm:grid-cols-3 lg:grid-cols-[repeat(5,minmax(0,1fr))_auto] lg:items-end"
    >
      <label className={etiqueta}>
        Tipo
        <select
          className={campo}
          value={filtros.tipo ?? ''}
          onChange={(e) => onCambio('tipo', e.target.value)}
        >
          <option value="">Todos los tipos</option>
          {tipos.data?.map((tipo) => (
            <option key={tipo.id} value={tipo.id}>
              {tipo.nombre}
            </option>
          ))}
        </select>
      </label>
      <label className={etiqueta}>
        Estado
        <select
          className={campo}
          value={filtros.estado ?? ''}
          onChange={(e) => onCambio('estado', e.target.value)}
        >
          <option value="">Abiertos</option>
          {ESTADOS.map((estado) => (
            <option key={estado} value={estado}>
              {nombreDeEstado(estado)}
            </option>
          ))}
          <option value={TODOS_LOS_ESTADOS}>Todos</option>
        </select>
      </label>
      <label className={etiqueta}>
        Área
        <select
          className={campo}
          value={filtros.area ?? ''}
          onChange={(e) => onCambio('area', e.target.value)}
        >
          <option value="">Todas las áreas</option>
          {areas.data?.map((area) => (
            <option key={area.id} value={area.id}>
              {area.nombre}
            </option>
          ))}
        </select>
      </label>
      <label className={etiqueta}>
        Desde
        <input
          type="date"
          className={campo}
          value={filtros.desde ?? ''}
          onChange={(e) => onCambio('desde', e.target.value)}
        />
      </label>
      <label className={etiqueta}>
        Hasta
        <input
          type="date"
          className={campo}
          value={filtros.hasta ?? ''}
          onChange={(e) => onCambio('hasta', e.target.value)}
        />
      </label>
      {hayFiltros && (
        <button
          type="button"
          onClick={onLimpiar}
          className="h-10 self-end rounded-tarjeta px-3 text-[15px] font-semibold text-primario"
        >
          Limpiar filtros
        </button>
      )}
    </form>
  )
}

function FilaDelTablero({ reclamo }: { reclamo: ReclamoEnTablero }) {
  const apoyos = reclamo.cantidad_apoyos === 1 ? 'apoyo' : 'apoyos'
  return (
    <Link
      to={`/tablero/reclamos/${reclamo.id}`}
      className="flex gap-3 rounded-tarjeta bg-superficie p-3 shadow-sm ring-1 ring-slate-200 transition-shadow hover:ring-2 hover:ring-primario"
    >
      <div className="flex w-16 shrink-0 flex-col items-center justify-center rounded-lg bg-amber-50 py-2 text-amber-800">
        <span className="text-[11px] font-semibold tracking-wide uppercase">Prioridad</span>
        <span className="font-display text-[22px] leading-none font-bold">
          {decimal.format(reclamo.prioridad)}
        </span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <p className="flex min-w-0 items-center gap-1.5 text-[15px] font-semibold">
            <span style={{ color: reclamo.tipo.color }}>
              <IconoTipo icono={reclamo.tipo.icono} className="size-4" />
            </span>
            <span className="truncate">{reclamo.tipo.nombre}</span>
            <span className="text-[13px] font-normal text-texto-2">#{reclamo.numero}</span>
          </p>
          <EstadoBadge estado={reclamo.estado} />
        </div>
        <p className="flex items-center gap-1 text-[15px]">
          <MapPin aria-hidden className="size-4 shrink-0 text-primario" />
          <span className="truncate">{textoDeUbicacion(reclamo)}</span>
        </p>
        <p className="flex flex-wrap items-center gap-x-2 text-[13px] text-texto-2">
          <span className="inline-flex items-center gap-1">
            <Users aria-hidden className="size-3.5" /> {reclamo.cantidad_apoyos} {apoyos}
          </span>
          <span>· gravedad {decimal.format(reclamo.gravedad_promedio)}</span>
          <span>· {hace(reclamo.creado_en)}</span>
          <span>· {reclamo.area ?? 'Sin área'}</span>
        </p>
      </div>
    </Link>
  )
}

/** CU-09: al tocar un marcador se abre su tarjeta sobre el mapa. */
function TarjetaDelMapa({
  reclamo,
  onCerrar,
}: {
  reclamo: ReclamoEnTablero
  onCerrar: () => void
}) {
  return (
    <div
      role="dialog"
      aria-label={`Reclamo #${reclamo.numero}`}
      className="absolute inset-x-3 bottom-3 z-10 flex gap-3 rounded-tarjeta bg-superficie p-3 shadow-lg ring-1 ring-slate-200"
    >
      {reclamo.foto_url && (
        <img
          src={reclamo.foto_url}
          alt=""
          className="size-16 shrink-0 rounded-lg bg-slate-200 object-cover"
        />
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[15px] font-semibold">
            {reclamo.tipo.nombre}{' '}
            <span className="font-normal text-texto-2">#{reclamo.numero}</span>
          </p>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="-m-1 grid size-8 shrink-0 place-items-center rounded-full text-texto-2"
          >
            <X aria-hidden className="size-4" />
          </button>
        </div>
        <p className="truncate text-[13px] text-texto-2">{textoDeUbicacion(reclamo)}</p>
        <div className="flex items-center justify-between gap-2">
          <EstadoBadge estado={reclamo.estado} />
          <Link
            to={`/tablero/reclamos/${reclamo.id}`}
            className="text-[15px] font-semibold text-primario"
          >
            Abrir el reclamo →
          </Link>
        </div>
      </div>
    </div>
  )
}

function Leyenda() {
  return (
    <ul aria-label="Colores por estado" className="flex flex-wrap gap-x-3 gap-y-1 text-[13px]">
      {ESTADOS.map((estado) => (
        <li key={estado} className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="size-2.5 rounded-full"
            style={{ backgroundColor: colorDeEstado(estado) }}
          />
          {nombreDeEstado(estado)}
        </li>
      ))}
    </ul>
  )
}

function ContenidoDelTablero() {
  const [parametros, setParametros] = useSearchParams()
  const filtros: Filtros = Object.fromEntries(
    CLAVES.flatMap((clave) => {
      const valor = parametros.get(clave)
      return valor ? [[clave, valor]] : []
    }),
  )
  const reclamos = useTablero(filtros)
  const [vista, setVista] = useState<'lista' | 'mapa'>('lista')
  const [seleccionado, setSeleccionado] = useState<number>()
  const lista = reclamos.data ?? []
  const elegido = lista.find((r) => r.id === seleccionado)

  const cambiarFiltro = (clave: keyof Filtros, valor: string) => {
    setSeleccionado(undefined)
    setParametros(
      (actuales) => {
        if (valor) actuales.set(clave, valor)
        else actuales.delete(clave)
        return actuales
      },
      { replace: true },
    )
  }
  const limpiar = () => {
    setSeleccionado(undefined)
    setParametros({}, { replace: true })
  }

  const boton = (activo: boolean) =>
    `flex h-10 flex-1 items-center justify-center gap-2 rounded-tarjeta text-[15px] font-semibold ${
      activo ? 'bg-primario text-white' : 'text-texto'
    }`

  return (
    <>
      <BarraDeFiltros filtros={filtros} onCambio={cambiarFiltro} onLimpiar={limpiar} />

      <div
        aria-label="Vista"
        className="flex gap-1 rounded-tarjeta bg-superficie p-1 ring-1 ring-slate-200 lg:hidden"
      >
        <button
          type="button"
          aria-pressed={vista === 'lista'}
          onClick={() => setVista('lista')}
          className={boton(vista === 'lista')}
        >
          <List aria-hidden className="size-4" /> Lista
        </button>
        <button
          type="button"
          aria-pressed={vista === 'mapa'}
          onClick={() => setVista('mapa')}
          className={boton(vista === 'mapa')}
        >
          <IconoMapa aria-hidden className="size-4" /> Mapa
        </button>
      </div>

      {reclamos.isError && <Alerta tipo="error">{reclamos.error.message}</Alerta>}

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <section
          aria-labelledby="titulo-cola"
          className={`flex flex-col gap-3 ${vista === 'mapa' ? 'hidden lg:flex' : ''}`}
        >
          <h1 id="titulo-cola" className="font-display text-[22px] font-bold">
            {reclamos.isPending
              ? 'Cargando reclamos…'
              : `${lista.length} ${lista.length === 1 ? 'reclamo' : 'reclamos'}`}
            <span className="ml-2 text-[15px] font-normal text-texto-2">
              de mayor a menor prioridad
            </span>
          </h1>
          {reclamos.isPending &&
            [0, 1, 2].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-tarjeta bg-slate-200" />
            ))}
          {reclamos.isSuccess && lista.length === 0 && (
            <div className="flex flex-col items-center gap-3 rounded-tarjeta bg-superficie px-4 py-10 text-center ring-1 ring-slate-200">
              <p className="text-[17px] font-semibold">No hay reclamos con estos filtros</p>
              <button
                type="button"
                onClick={limpiar}
                className="rounded-tarjeta border border-primario px-4 py-2 text-[15px] font-semibold text-primario"
              >
                Limpiar filtros
              </button>
            </div>
          )}
          {lista.length > 0 && (
            <ol aria-label="Reclamos por prioridad" className="flex flex-col gap-3">
              {lista.map((reclamo) => (
                <li key={reclamo.id}>
                  <FilaDelTablero reclamo={reclamo} />
                </li>
              ))}
            </ol>
          )}
        </section>

        <section
          aria-label="Mapa de reclamos"
          className={`flex flex-col gap-2 lg:sticky lg:top-[88px] ${
            vista === 'lista' ? 'hidden lg:flex' : ''
          }`}
        >
          <div className="relative">
            {lista.length > 0 ? (
              <MapaDeReclamos
                reclamos={lista}
                onElegir={setSeleccionado}
                seleccionado={seleccionado}
                colorDe={(r) => colorDeEstado(r.estado ?? '')}
                agrupar
                className="h-[65dvh] rounded-hoja shadow-sm ring-1 ring-slate-300 lg:h-[calc(100dvh-220px)]"
              />
            ) : (
              <div className="grid h-[40dvh] place-items-center rounded-hoja bg-slate-100 text-[15px] text-texto-2 ring-1 ring-slate-300">
                Sin reclamos para mostrar en el mapa
              </div>
            )}
            {elegido && (
              <TarjetaDelMapa reclamo={elegido} onCerrar={() => setSeleccionado(undefined)} />
            )}
          </div>
          <Leyenda />
        </section>
      </div>
    </>
  )
}

/** CU-07 y CU-09: la cola priorizada con filtros y, al lado, el mapa de los mismos reclamos. */
export default function Tablero() {
  return (
    <MarcoMunicipal>
      <ContenidoDelTablero />
    </MarcoMunicipal>
  )
}
