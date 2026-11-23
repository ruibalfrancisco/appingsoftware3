import { MapPin } from 'lucide-react'

/**
 * Pin fijo en el centro: se mueve el mapa, no el pin. Mientras el mapa se mueve, el pin se
 * eleva con su sombra; al soltar, cae con un rebote suave (guía visual: 300 ms). Con "reducir
 * movimiento" activado no hay animación.
 */
export default function PinCentral({
  dentro,
  moviendo = false,
}: {
  dentro: boolean
  moviendo?: boolean
}) {
  return (
    <div className="pointer-events-none absolute inset-0 grid place-items-center">
      <div className="relative -translate-y-[22px]">
        <MapPin
          aria-hidden
          className={`size-11 drop-shadow-md motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-[cubic-bezier(.34,1.56,.64,1)] ${
            moviendo ? '-translate-y-3' : ''
          } ${dentro ? 'text-primario' : 'text-error'}`}
          fill="white"
          strokeWidth={2.25}
        />
        <span
          aria-hidden
          className={`absolute top-full left-1/2 -mt-1 h-1.5 w-4 -translate-x-1/2 rounded-full bg-black/35 blur-[1px] motion-safe:transition-transform motion-safe:duration-300 ${
            moviendo ? 'scale-150 opacity-60' : ''
          }`}
        />
      </div>
    </div>
  )
}
