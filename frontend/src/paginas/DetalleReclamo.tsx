import { MapPin } from 'lucide-react'
import { useParams } from 'react-router'
import { Alerta, Pantalla } from '../componentes/ui'
import { etiquetaGravedad } from '../dominio/gravedad'
import { useReclamo } from '../reclamos/api'
import { EstadoBadge } from '../reclamos/EstadoBadge'
import { fechaYHora, textoDeUbicacion } from '../reclamos/formato'
import MapaDeReclamos from '../reclamos/mapa/MapaDeReclamos'

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
    <Pantalla
      titulo={r.tipo.nombre}
      bajada={`Reclamo #${r.numero}`}
      volverA={r.es_propio ? '/mis-reclamos' : '/'}
    >
      {fotoReporte && (
        <img
          src={fotoReporte.url}
          alt={`Foto del reclamo: ${r.tipo.nombre}`}
          width={fotoReporte.ancho}
          height={fotoReporte.alto}
          className="h-auto w-full rounded-tarjeta object-cover"
        />
      )}
      <div className="flex flex-wrap items-center gap-2">
        <EstadoBadge estado={r.estado} />
      </div>
      {r.descripcion && <p className="text-[17px] whitespace-pre-line">{r.descripcion}</p>}

      <section
        aria-labelledby="titulo-ubicacion"
        className="overflow-hidden rounded-tarjeta bg-superficie ring-1 ring-slate-200"
      >
        <MapaDeReclamos reclamos={[r]} className="h-44" />
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
          <dd>{fechaYHora(r.creado_en)}</dd>
        </div>
      </dl>
    </Pantalla>
  )
}
