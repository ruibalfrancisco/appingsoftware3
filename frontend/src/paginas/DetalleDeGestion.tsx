import { MapPin } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { Alerta } from '../componentes/ui'
import { etiquetaGravedad } from '../dominio/gravedad'
import { useReclamoDeGestion } from '../gestion/api'
import MarcoMunicipal from '../gestion/MarcoMunicipal'
import PanelDeEstado from '../gestion/PanelDeEstado'
import { EstadoBadge } from '../reclamos/EstadoBadge'
import { fechaYHora, textoDeUbicacion } from '../reclamos/formato'
import Historial from '../reclamos/Historial'
import IconoTipo from '../reclamos/IconoTipo'
import MapaDeReclamos from '../reclamos/mapa/MapaDeReclamos'

const decimal = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

function ContenidoDelDetalle() {
  const id = Number(useParams().id)
  const reclamo = useReclamoDeGestion(id)

  if (reclamo.isPending) return <div className="h-80 animate-pulse rounded-tarjeta bg-slate-200" />
  if (reclamo.isError) return <Alerta tipo="error">{reclamo.error.message}</Alerta>

  const r = reclamo.data
  const reporte = r.fotos.find((f) => f.tipo === 'reporte')
  const despues = r.fotos.find((f) => f.tipo === 'resolucion')
  const tarjeta = 'rounded-tarjeta bg-superficie p-4 shadow-sm ring-1 ring-slate-200'

  return (
    <>
      <Link to="/tablero" className="text-[15px] font-semibold text-primario">
        ← Volver al tablero
      </Link>
      <header className="flex flex-wrap items-center gap-3">
        <span style={{ color: r.tipo.color }}>
          <IconoTipo icono={r.tipo.icono} className="size-7" />
        </span>
        <h1 className="font-display text-[28px] leading-tight font-bold">
          {r.tipo.nombre} <span className="text-texto-2">#{r.numero}</span>
        </h1>
        <EstadoBadge estado={r.estado} />
      </header>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex flex-col gap-4">
          <div className={`grid gap-3 ${despues ? 'sm:grid-cols-2' : ''}`}>
            {reporte && (
              <figure className="flex flex-col gap-1">
                <img
                  src={reporte.url}
                  alt={`Foto del vecino: ${r.tipo.nombre}`}
                  className="aspect-[4/3] w-full rounded-tarjeta bg-slate-200 object-cover"
                />
                <figcaption className="text-[13px] text-texto-2">Foto del vecino</figcaption>
              </figure>
            )}
            {despues && (
              <figure className="flex flex-col gap-1">
                <img
                  src={despues.url}
                  alt="Foto del después"
                  className="aspect-[4/3] w-full rounded-tarjeta bg-slate-200 object-cover"
                />
                <figcaption className="text-[13px] text-texto-2">Después</figcaption>
              </figure>
            )}
          </div>
          {r.descripcion && (
            <section aria-labelledby="titulo-descripcion" className={tarjeta}>
              <h2 id="titulo-descripcion" className="text-[13px] text-texto-2">
                Descripción del vecino
              </h2>
              <p className="text-[17px] whitespace-pre-line">{r.descripcion}</p>
            </section>
          )}
          <section
            aria-labelledby="titulo-ubicacion"
            className="overflow-hidden rounded-tarjeta bg-superficie shadow-sm ring-1 ring-slate-200"
          >
            <MapaDeReclamos reclamos={[r]} className="h-56" />
            <div className="flex items-start gap-2 p-4">
              <MapPin aria-hidden className="mt-0.5 size-5 shrink-0 text-primario" />
              <div>
                <h2 id="titulo-ubicacion" className="text-[13px] text-texto-2">
                  Ubicación
                </h2>
                <p className="text-[15px] font-semibold">{textoDeUbicacion(r)}</p>
              </div>
            </div>
          </section>
        </div>

        <div className="flex flex-col gap-4">
          <dl className={`grid grid-cols-2 gap-3 text-[15px] ${tarjeta}`}>
            <div>
              <dt className="text-[13px] text-texto-2">Prioridad</dt>
              <dd className="font-display text-[22px] font-bold text-amber-800">
                {decimal.format(r.prioridad)}
              </dd>
            </div>
            <div>
              <dt className="text-[13px] text-texto-2">Apoyos</dt>
              <dd className="font-display text-[22px] font-bold">{r.cantidad_apoyos}</dd>
            </div>
            <div>
              <dt className="text-[13px] text-texto-2">Gravedad promedio</dt>
              <dd className="font-semibold">
                {decimal.format(r.gravedad_promedio)} ·{' '}
                {etiquetaGravedad(Math.round(r.gravedad_promedio))}
              </dd>
            </div>
            <div>
              <dt className="text-[13px] text-texto-2">Área</dt>
              <dd className="font-semibold">{r.area?.nombre ?? 'Sin asignar'}</dd>
            </div>
            <div>
              <dt className="text-[13px] text-texto-2">Cargado</dt>
              <dd>{fechaYHora(r.creado_en)}</dd>
            </div>
            <div>
              <dt className="text-[13px] text-texto-2">Último cambio</dt>
              <dd>{fechaYHora(r.actualizado_en)}</dd>
            </div>
          </dl>

          <PanelDeEstado reclamo={r} />

          <section aria-labelledby="titulo-historial" className={tarjeta}>
            <h2 id="titulo-historial" className="mb-3 font-display text-[17px] font-semibold">
              Historial
            </h2>
            <Historial entradas={r.historial} />
          </section>
        </div>
      </div>
    </>
  )
}

/** RF-27 y CU-08: todo lo del reclamo y, al costado, el cambio de estado y su historial. */
export default function DetalleDeGestion() {
  return (
    <MarcoMunicipal>
      <ContenidoDelDetalle />
    </MarcoMunicipal>
  )
}
