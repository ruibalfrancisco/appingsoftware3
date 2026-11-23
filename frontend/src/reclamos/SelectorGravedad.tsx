import { etiquetaGravedad } from '../dominio/gravedad'
import { colorGravedad } from './detalles'

/**
 * RN-03: deslizador del 1 al 10 que cambia de verde a rojo con la etiqueta Leve, Moderado,
 * Grave o Urgente. Se usa al crear un reclamo y al apoyar uno (CU-05).
 */
export default function SelectorGravedad({
  id,
  valor,
  onCambio,
  etiqueta = '¿Qué tan grave es?',
}: {
  id: string
  valor: number
  onCambio: (valor: number) => void
  etiqueta?: string
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="flex items-center justify-between text-[15px] font-semibold">
        {etiqueta}
        <span
          className="rounded-full px-3 py-1 text-[13px] text-white"
          style={{ backgroundColor: colorGravedad(valor) }}
        >
          {valor} · {etiquetaGravedad(valor)}
        </span>
      </label>
      <input
        id={id}
        type="range"
        min={1}
        max={10}
        step={1}
        value={valor}
        onChange={(evento) => onCambio(Number(evento.target.value))}
        aria-valuetext={`${valor}, ${etiquetaGravedad(valor)}`}
        className="w-full accent-primario"
      />
      <div className="flex justify-between text-[13px] text-texto-2" aria-hidden>
        <span>Leve</span>
        <span>Urgente</span>
      </div>
    </div>
  )
}
