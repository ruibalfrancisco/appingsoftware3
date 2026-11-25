import type { EntradaDeHistorial } from './api'
import { colorDeEstado, nombreDeEstado } from './estados'
import { fechaYHora } from './formato'

/** RN-05: cada cambio de estado con su fecha y su comentario; en el back office, con autor. */
export default function Historial({ entradas }: { entradas: EntradaDeHistorial[] }) {
  return (
    <ol className="flex flex-col gap-4 border-l-2 border-slate-200 pl-5">
      {entradas.map((entrada) => (
        <li key={`${entrada.creado_en}-${entrada.estado_nuevo}`} className="relative">
          <span
            aria-hidden
            className="absolute top-1.5 -left-[27px] size-3 rounded-full ring-4 ring-fondo"
            style={{ backgroundColor: colorDeEstado(entrada.estado_nuevo) }}
          />
          <p className="text-[15px] font-semibold">
            {entrada.estado_anterior === null
              ? 'Reclamo cargado'
              : `Pasó a ${nombreDeEstado(entrada.estado_nuevo)}`}
          </p>
          <p className="text-[13px] text-texto-2">
            {fechaYHora(entrada.creado_en)}
            {entrada.autor && ` · ${entrada.autor}`}
          </p>
          {entrada.comentario && (
            <p className="mt-1 rounded-tarjeta bg-fondo px-3 py-2 text-[15px] whitespace-pre-line ring-1 ring-slate-200">
              {entrada.comentario}
            </p>
          )}
        </li>
      ))}
    </ol>
  )
}
