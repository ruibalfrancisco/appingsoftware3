import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from 'lucide-react'
import { useState, type KeyboardEvent } from 'react'
import type { Posicion } from '../api'
import { desplazar } from '../geocerca'
import type { PropsMapa } from './MapaSelector'
import PinCentral from './PinCentral'

const PASO_METROS = 25

/**
 * Reemplazo de Google Maps cuando no hay key. Mismo contrato: el pin queda en el centro y se
 * "mueve el mapa" con los botones o con las flechas del teclado (RNF-06). Se remonta (key) cuando
 * cambia el centro pedido desde afuera, así arranca de nuevo desde ahí.
 */
export default function MapaSimulado({ centro, onCambio, dentro }: PropsMapa) {
  const [posicion, setPosicion] = useState<Posicion>(centro)

  const mover = (norte: number, este: number) => {
    const nueva = desplazar(posicion, norte * PASO_METROS, este * PASO_METROS)
    setPosicion(nueva)
    onCambio(nueva)
  }

  const conTeclado = (evento: KeyboardEvent) => {
    const direcciones: Record<string, [number, number]> = {
      ArrowUp: [1, 0],
      ArrowDown: [-1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
    }
    const direccion = direcciones[evento.key]
    if (direccion) {
      evento.preventDefault()
      mover(...direccion)
    }
  }

  const boton =
    'grid size-11 place-items-center rounded-full bg-superficie shadow ring-1 ring-slate-200'

  return (
    <div className="flex flex-col gap-2">
      <div
        role="application"
        aria-label="Mapa simulado. Mové el pin con las flechas del teclado."
        tabIndex={0}
        onKeyDown={conTeclado}
        className="relative h-[45dvh] overflow-hidden rounded-hoja bg-[linear-gradient(#e2e8f0_1px,transparent_1px),linear-gradient(90deg,#e2e8f0_1px,transparent_1px)] bg-[size:32px_32px] ring-1 ring-slate-300 focus:ring-2 focus:ring-primario"
      >
        <PinCentral dentro={dentro} />
        <p className="absolute bottom-2 left-2 rounded bg-white/90 px-2 py-1 text-[13px] text-texto-2">
          Mapa simulado · {posicion.latitud.toFixed(5)}, {posicion.longitud.toFixed(5)}
        </p>
      </div>
      <div className="flex justify-center gap-2" aria-label="Mover el mapa">
        <button
          type="button"
          className={boton}
          onClick={() => mover(0, -1)}
          aria-label="Mover al oeste"
        >
          <ArrowLeft aria-hidden />
        </button>
        <button
          type="button"
          className={boton}
          onClick={() => mover(1, 0)}
          aria-label="Mover al norte"
        >
          <ArrowUp aria-hidden />
        </button>
        <button
          type="button"
          className={boton}
          onClick={() => mover(-1, 0)}
          aria-label="Mover al sur"
        >
          <ArrowDown aria-hidden />
        </button>
        <button
          type="button"
          className={boton}
          onClick={() => mover(0, 1)}
          aria-label="Mover al este"
        >
          <ArrowRight aria-hidden />
        </button>
      </div>
    </div>
  )
}
