import { LocateFixed } from 'lucide-react'

/** Botón flotante dentro del mapa, como el de las apps de mapas. */
export default function BotonUbicarme({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Usar mi ubicación"
      title="Usar mi ubicación"
      className="absolute right-3 bottom-14 grid size-12 place-items-center rounded-full bg-superficie text-primario shadow-md ring-1 ring-slate-200 active:scale-95"
    >
      <LocateFixed aria-hidden className="size-6" />
    </button>
  )
}
