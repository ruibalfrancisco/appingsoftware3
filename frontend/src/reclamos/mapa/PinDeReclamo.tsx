import IconoTipo from '../IconoTipo'

/**
 * Marcador con el color y el ícono del tipo de reclamo, en forma de gota como en las apps de
 * mapas. La punta queda en el borde de abajo: se ancla por abajo (anchor="bottom").
 */
export default function PinDeReclamo({ color, icono }: { color: string; icono: string }) {
  return (
    <span className="relative block h-[45px] w-9 drop-shadow-md">
      <span
        aria-hidden
        className="absolute top-[30px] left-1/2 size-3 -translate-x-1/2 rotate-45 border-r-2 border-b-2 border-white"
        style={{ backgroundColor: color }}
      />
      <span
        className="relative grid size-9 place-items-center rounded-full border-2 border-white text-white"
        style={{ backgroundColor: color }}
      >
        <IconoTipo icono={icono} className="size-[18px]" />
      </span>
    </span>
  )
}
