import { MapPin } from 'lucide-react'

/** Pin fijo en el centro: se mueve el mapa, no el pin (guía visual). */
export default function PinCentral({ dentro }: { dentro: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <MapPin
        aria-hidden
        className={`size-11 -translate-y-1/2 drop-shadow-md ${dentro ? 'text-primario' : 'text-error'}`}
        fill="white"
        strokeWidth={2.25}
      />
    </div>
  )
}
