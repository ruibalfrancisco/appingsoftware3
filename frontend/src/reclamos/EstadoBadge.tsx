import { claseDeEstado, nombreDeEstado } from './estados'

export function EstadoBadge({ estado }: { estado: string }) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-[13px] font-semibold whitespace-nowrap text-white ${claseDeEstado(estado)}`}
    >
      {nombreDeEstado(estado)}
    </span>
  )
}
