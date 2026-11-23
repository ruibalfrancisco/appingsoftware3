import { ClipboardList, MapPin, Plus } from 'lucide-react'
import { Link, Navigate, useNavigate } from 'react-router'
import { Alerta, Pantalla } from '../componentes/ui'
import { useSesion } from '../cuentas/api'
import { useMisReclamos, type ReclamoResumen } from '../reclamos/api'
import { EstadoBadge } from '../reclamos/EstadoBadge'
import { fecha, textoDeUbicacion } from '../reclamos/formato'
import IconoTipo from '../reclamos/IconoTipo'
import MapaDeReclamos from '../reclamos/mapa/MapaDeReclamos'

function TarjetaDeReclamo({ reclamo }: { reclamo: ReclamoResumen }) {
  return (
    <Link
      to={`/reclamos/${reclamo.id}`}
      className="flex gap-3 rounded-tarjeta bg-superficie p-3 shadow-sm ring-1 ring-slate-200 transition-transform active:scale-[0.99]"
    >
      {reclamo.foto_url ? (
        <img
          src={reclamo.foto_url}
          alt=""
          loading="lazy"
          className="size-20 shrink-0 rounded-lg bg-slate-200 object-cover"
        />
      ) : (
        <span
          className="grid size-20 shrink-0 place-items-center rounded-lg bg-slate-100"
          style={{ color: reclamo.tipo.color }}
        >
          <IconoTipo icono={reclamo.tipo.icono} className="size-8" />
        </span>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <p className="flex min-w-0 items-start gap-1.5 text-[15px] leading-snug font-semibold">
            <span className="mt-0.5" style={{ color: reclamo.tipo.color }}>
              <IconoTipo icono={reclamo.tipo.icono} className="size-4" />
            </span>
            {reclamo.tipo.nombre}
          </p>
          <span className="shrink-0">
            <EstadoBadge estado={reclamo.estado} />
          </span>
        </div>
        <p className="flex items-start gap-1 text-[15px]">
          <MapPin aria-hidden className="mt-0.5 size-4 shrink-0 text-primario" />
          <span className="line-clamp-2">{textoDeUbicacion(reclamo)}</span>
        </p>
        {reclamo.descripcion && (
          <p className="truncate text-[13px] text-texto-2">{reclamo.descripcion}</p>
        )}
        <p className="text-[13px] text-texto-2">
          #{reclamo.numero} · {fecha(reclamo.creado_en)}
        </p>
      </div>
    </Link>
  )
}

function SinReclamos() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-tarjeta bg-superficie px-4 py-10 text-center ring-1 ring-slate-200">
      <span className="grid size-16 place-items-center rounded-full bg-teal-50 text-primario">
        <ClipboardList aria-hidden className="size-8" />
      </span>
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-[19px] font-semibold">Todavía no cargaste reclamos</h2>
        <p className="text-[15px] text-texto-2">
          Cuando reportes un problema, lo vas a ver acá con su ubicación y su estado.
        </p>
      </div>
      <Link
        to="/reclamos/nuevo"
        className="flex h-[52px] w-full items-center justify-center gap-2 rounded-tarjeta bg-primario text-[17px] font-semibold text-white"
      >
        <Plus aria-hidden className="size-5" strokeWidth={2.5} /> Nuevo reclamo
      </Link>
    </div>
  )
}

function cuantos(cantidad: number): string {
  return cantidad === 1 ? 'Tenés 1 reclamo cargado.' : `Tenés ${cantidad} reclamos cargados.`
}

/** Los reclamos del vecino: todos en el mapa y, abajo, la lista con su ubicación y estado. */
export default function MisReclamos() {
  const sesion = useSesion()
  const reclamos = useMisReclamos(Boolean(sesion.data))
  const navegar = useNavigate()

  if (sesion.isPending)
    return <div className="m-4 h-40 animate-pulse rounded-tarjeta bg-slate-200" />
  if (!sesion.data) {
    return <Navigate to="/ingresar" replace state={{ aviso: 'Ingresá para ver tus reclamos.' }} />
  }

  const lista = reclamos.data ?? []
  return (
    <Pantalla
      titulo="Mis reclamos"
      bajada={lista.length > 0 ? cuantos(lista.length) : undefined}
      volverA="/"
    >
      {reclamos.isPending && (
        <div className="flex flex-col gap-3" aria-hidden>
          <div className="h-56 animate-pulse rounded-hoja bg-slate-200" />
          <div className="h-[104px] animate-pulse rounded-tarjeta bg-slate-200" />
          <div className="h-[104px] animate-pulse rounded-tarjeta bg-slate-200" />
        </div>
      )}
      {reclamos.isError && <Alerta tipo="error">{reclamos.error.message}</Alerta>}
      {reclamos.isSuccess && lista.length === 0 && <SinReclamos />}
      {lista.length > 0 && (
        <>
          <MapaDeReclamos
            reclamos={lista}
            onElegir={(id) => void navegar(`/reclamos/${id}`)}
            className="h-56 rounded-hoja shadow-sm ring-1 ring-slate-300"
          />
          <ul aria-label="Tus reclamos" className="flex flex-col gap-3">
            {lista.map((reclamo) => (
              <li key={reclamo.id}>
                <TarjetaDeReclamo reclamo={reclamo} />
              </li>
            ))}
          </ul>
        </>
      )}
    </Pantalla>
  )
}
