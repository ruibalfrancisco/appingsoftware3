import { useParams } from 'react-router'
import { Alerta, Pantalla } from '../componentes/ui'
import { etiquetaGravedad } from '../dominio/gravedad'
import { useReclamo } from '../reclamos/api'
import IconoTipo from '../reclamos/IconoTipo'
import { EstadoBadge } from '../reclamos/EstadoBadge'

// RNF-14: fechas dd/mm/aaaa en la hora de Córdoba.
const fecha = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23', // 00:12 y no 12:12 a. m.
  timeZone: 'America/Argentina/Cordoba',
})

export default function DetalleReclamo() {
  const id = Number(useParams().id)
  const reclamo = useReclamo(id)

  if (reclamo.isPending) {
    return <div className="m-4 h-80 animate-pulse rounded-tarjeta bg-slate-200" />
  }
  if (reclamo.isError) {
    return (
      <Pantalla titulo="Reclamo" volverA="/">
        <Alerta tipo="error">{reclamo.error.message}</Alerta>
      </Pantalla>
    )
  }

  const r = reclamo.data
  const fotoReporte = r.fotos.find((f) => f.tipo === 'reporte')
  return (
    <Pantalla titulo={r.titulo} bajada={`Reclamo #${r.numero}`} volverA="/">
      {fotoReporte && (
        <img
          src={fotoReporte.url}
          alt={`Foto del reclamo: ${r.titulo}`}
          width={fotoReporte.ancho}
          height={fotoReporte.alto}
          className="h-auto w-full rounded-tarjeta object-cover"
        />
      )}
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="inline-flex items-center gap-1 rounded-full bg-superficie px-3 py-1 text-[13px] font-semibold ring-1 ring-slate-200"
          style={{ color: r.tipo.color }}
        >
          <IconoTipo icono={r.tipo.icono} className="size-4" /> {r.tipo.nombre}
        </span>
        <EstadoBadge estado={r.estado} />
      </div>
      <dl className="grid grid-cols-2 gap-3 rounded-tarjeta bg-superficie p-4 text-[15px] ring-1 ring-slate-200">
        <div>
          <dt className="text-[13px] text-texto-2">Apoyos</dt>
          <dd className="font-semibold">{r.cantidad_apoyos}</dd>
        </div>
        <div>
          <dt className="text-[13px] text-texto-2">Gravedad</dt>
          <dd className="font-semibold">
            {r.gravedad_promedio.toFixed(1)} · {etiquetaGravedad(Math.round(r.gravedad_promedio))}
          </dd>
        </div>
        <div className="col-span-2">
          <dt className="text-[13px] text-texto-2">Cargado</dt>
          <dd>{fecha.format(new Date(r.creado_en))}</dd>
        </div>
        {r.direccion && (
          <div className="col-span-2">
            <dt className="text-[13px] text-texto-2">Dirección</dt>
            <dd>{r.direccion}</dd>
          </div>
        )}
        {r.descripcion && (
          <div className="col-span-2">
            <dt className="text-[13px] text-texto-2">Descripción</dt>
            <dd>{r.descripcion}</dd>
          </div>
        )}
      </dl>
    </Pantalla>
  )
}
