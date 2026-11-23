import { useMutation } from '@tanstack/react-query'
import { Check, MapPin, Users } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Alerta, BotonPrincipal } from '../componentes/ui'
import { apoyarReclamo, type ApoyoRegistrado, type ReclamoSimilar } from './api'
import { EstadoBadge } from './EstadoBadge'
import IconoTipo from './IconoTipo'
import SelectorGravedad from './SelectorGravedad'

function textoDeApoyos(cantidad: number): string {
  return cantidad === 1 ? 'apoyo' : 'apoyos'
}

/** El número entra rodando desde abajo cada vez que cambia (guía visual: 400 ms). */
function ContadorDeApoyos({ valor }: { valor: number }) {
  return (
    <span className="inline-flex overflow-hidden">
      <span key={valor} className="inline-block motion-safe:animate-rodar">
        {valor}
      </span>
    </span>
  )
}

function TarjetaSimilar({
  reclamo,
  onApoyado,
}: {
  reclamo: ReclamoSimilar
  onApoyado: (reclamo: ReclamoSimilar, registrado: ApoyoRegistrado) => void
}) {
  const [eligiendo, setEligiendo] = useState(false)
  const [gravedad, setGravedad] = useState(5)
  const apoyo = useMutation({
    mutationFn: () => apoyarReclamo(reclamo.id, gravedad),
    onSuccess: (registrado) => onApoyado(reclamo, registrado),
  })
  const distancia = reclamo.distancia_m < 1 ? 'En el mismo lugar' : `A ${reclamo.distancia_m} m`

  return (
    <article
      aria-label={`Reclamo #${reclamo.numero}`}
      className="flex flex-col gap-3 rounded-tarjeta bg-superficie p-3 shadow-sm ring-1 ring-slate-200"
    >
      <div className="flex gap-3">
        {reclamo.foto_url ? (
          <img
            src={reclamo.foto_url}
            alt=""
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
            <p className="text-[13px] font-semibold text-texto-2">#{reclamo.numero}</p>
            <span className="shrink-0">
              <EstadoBadge estado={reclamo.estado} />
            </span>
          </div>
          <p className="line-clamp-2 text-[15px] leading-snug font-semibold">
            {reclamo.descripcion || reclamo.tipo.nombre}
          </p>
          <p className="flex items-start gap-1 text-[13px] text-texto-2">
            <MapPin aria-hidden className="mt-0.5 size-3.5 shrink-0 text-primario" />
            <span className="line-clamp-2">
              {distancia}
              {reclamo.direccion && ` · ${reclamo.direccion}`}
            </span>
          </p>
          <p className="inline-flex items-center gap-1 self-start rounded-full bg-amber-50 px-2 py-0.5 text-[13px] font-semibold text-amber-800">
            <Users aria-hidden className="size-3.5" />
            {reclamo.cantidad_apoyos} {textoDeApoyos(reclamo.cantidad_apoyos)}
          </p>
        </div>
      </div>

      {reclamo.es_propio ? (
        <p className="rounded-tarjeta bg-slate-100 px-3 py-2 text-center text-[15px] text-texto-2">
          Es tuyo: ya cuenta como el primer apoyo
        </p>
      ) : reclamo.ya_apoyado ? (
        <p className="flex items-center justify-center gap-1 rounded-tarjeta bg-green-50 px-3 py-2 text-[15px] font-semibold text-exito-texto">
          <Check aria-hidden className="size-4" /> Ya lo apoyaste
        </p>
      ) : !eligiendo ? (
        <button
          type="button"
          onClick={() => setEligiendo(true)}
          className="h-12 rounded-tarjeta bg-primario text-[17px] font-semibold text-white transition-transform active:scale-[0.98]"
        >
          Yo también lo vi
        </button>
      ) : (
        // CU-05 paso 3: la gravedad según este vecino; la foto que sacó no se guarda.
        <div className="flex flex-col gap-3 rounded-tarjeta bg-fondo p-3 ring-1 ring-slate-200">
          <SelectorGravedad
            id={`gravedad-apoyo-${reclamo.id}`}
            valor={gravedad}
            onCambio={setGravedad}
            etiqueta="¿Qué tan grave te parece?"
          />
          {apoyo.isError && <Alerta tipo="error">{apoyo.error.message}</Alerta>}
          <BotonPrincipal type="button" cargando={apoyo.isPending} onClick={() => apoyo.mutate()}>
            Sumar mi apoyo
          </BotonPrincipal>
        </div>
      )}
    </article>
  )
}

/**
 * CU-05: hoja que sube desde abajo con los reclamos parecidos (RN-01). El vecino apoya uno
 * con "Yo también lo vi" o sigue con el suyo con "No es ninguno" (RF-13).
 */
export function HojaDeSimilares({
  similares,
  onNinguno,
  onCerrar,
  onApoyado,
}: {
  similares: ReclamoSimilar[]
  onNinguno: () => void
  /** Escape: vuelve al mapa para corregir el pin. */
  onCerrar: () => void
  onApoyado: (reclamo: ReclamoSimilar, registrado: ApoyoRegistrado) => void
}) {
  const titulo = useRef<HTMLHeadingElement>(null)
  useEffect(() => titulo.current?.focus(), [])
  const cantidad = similares.length

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-900/40 motion-safe:animate-aparecer">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-similares"
        aria-describedby="bajada-similares"
        onKeyDown={(evento) => evento.key === 'Escape' && onCerrar()}
        className="flex max-h-[88dvh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-t-hoja bg-fondo px-4 pt-3 shadow-2xl motion-safe:animate-hoja"
      >
        <div aria-hidden className="mx-auto h-1.5 w-10 shrink-0 rounded-full bg-slate-300" />
        <header className="flex flex-col gap-1">
          <h2
            id="titulo-similares"
            ref={titulo}
            tabIndex={-1}
            className="font-display text-[22px] leading-tight font-bold outline-none"
          >
            ¿Es alguno de estos?
          </h2>
          <p id="bajada-similares" className="text-[15px] text-texto-2">
            {cantidad === 1 ? 'Ya hay un reclamo' : `Ya hay ${cantidad} reclamos`} del mismo tipo a
            menos de 50 m. Si es el mismo problema, sumá tu apoyo: así sube su prioridad.
          </p>
        </header>
        <ul aria-label="Reclamos parecidos" className="flex flex-col gap-3">
          {similares.map((similar, indice) => (
            <li
              key={similar.id}
              className="motion-safe:animate-tarjeta"
              style={{ animationDelay: `${100 + indice * 60}ms` }}
            >
              <TarjetaSimilar reclamo={similar} onApoyado={onApoyado} />
            </li>
          ))}
        </ul>
        {/* Fijo abajo: con varias tarjetas, la otra salida tiene que estar siempre a mano. */}
        <div className="sticky bottom-0 -mx-4 mt-auto shrink-0 bg-fondo px-4 pt-3 pb-6 shadow-[0_-12px_16px_-12px_rgb(15_23_42/0.2)]">
          <button
            type="button"
            onClick={onNinguno}
            className="h-[52px] w-full rounded-tarjeta border border-slate-300 bg-superficie text-[17px] font-semibold"
          >
            No es ninguno, cargar uno nuevo
          </button>
        </div>
      </section>
    </div>
  )
}

/** CU-05 pasos 4 y 5: el contador sube con un pulso y se confirma el apoyo. */
export function ApoyoConfirmado({ registrado }: { registrado: ApoyoRegistrado }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="grid size-20 place-items-center rounded-full bg-green-100 text-exito-texto">
        <Check aria-hidden className="size-10" strokeWidth={3} />
      </div>
      <h1 className="font-display text-[28px] font-bold">¡Gracias por sumar tu apoyo!</h1>
      <div className="flex flex-col items-center gap-1">
        <p
          aria-live="polite"
          className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-4 py-2 text-[22px] font-bold text-amber-800 motion-safe:animate-pulso"
        >
          <Users aria-hidden className="size-6" />
          <ContadorDeApoyos valor={registrado.cantidad_apoyos} />{' '}
          {textoDeApoyos(registrado.cantidad_apoyos)}
        </p>
        <p className="text-[15px] text-texto-2">en el reclamo #{registrado.numero}</p>
      </div>
      <p className="text-[17px] text-texto-2">
        Mientras más vecinos lo apoyan, más prioridad tiene para la Municipalidad. Te vamos a avisar
        cuando cambie de estado.
      </p>
      <Link
        to={`/reclamos/${registrado.numero}`}
        className="flex h-[52px] w-full items-center justify-center rounded-tarjeta bg-primario text-[17px] font-semibold text-white"
      >
        Ver el reclamo
      </Link>
      <Link to="/" className="text-[17px] font-semibold text-primario">
        Volver al inicio
      </Link>
    </main>
  )
}
