// Colores por estado de la guía visual. Texto blanco sobre el color: contraste de 4,5:1 o más.
const ESTADOS: Record<string, { nombre: string; clase: string }> = {
  PENDIENTE: { nombre: 'Pendiente', clase: 'bg-estado-pendiente' },
  EN_REVISION: { nombre: 'En revisión', clase: 'bg-estado-revision' },
  EN_PROCESO: { nombre: 'En proceso', clase: 'bg-amber-700' },
  RESUELTO: { nombre: 'Resuelto', clase: 'bg-exito-texto' },
  RECHAZADO: { nombre: 'Rechazado', clase: 'bg-estado-rechazado' },
}

export function EstadoBadge({ estado }: { estado: string }) {
  const { nombre, clase } = ESTADOS[estado] ?? { nombre: estado, clase: 'bg-slate-600' }
  return (
    <span className={`rounded-full px-3 py-1 text-[13px] font-semibold text-white ${clase}`}>
      {nombre}
    </span>
  )
}
