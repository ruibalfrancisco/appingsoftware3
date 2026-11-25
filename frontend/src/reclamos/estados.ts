// Estados de RN-05 con su nombre y su color de la guía visual. Texto blanco sobre el color:
// contraste de 4,5:1 o más (RNF-06).
export const ESTADOS = ['PENDIENTE', 'EN_REVISION', 'EN_PROCESO', 'RESUELTO', 'RECHAZADO'] as const
export type Estado = (typeof ESTADOS)[number]

export const ESTADOS_ABIERTOS: readonly Estado[] = ['PENDIENTE', 'EN_REVISION', 'EN_PROCESO']

const DATOS: Record<Estado, { nombre: string; color: string; clase: string }> = {
  PENDIENTE: { nombre: 'Pendiente', color: '#64748B', clase: 'bg-estado-pendiente' },
  EN_REVISION: { nombre: 'En revisión', color: '#2563EB', clase: 'bg-estado-revision' },
  EN_PROCESO: { nombre: 'En proceso', color: '#B45309', clase: 'bg-amber-700' },
  RESUELTO: { nombre: 'Resuelto', color: '#15803D', clase: 'bg-exito-texto' },
  RECHAZADO: { nombre: 'Rechazado', color: '#DC2626', clase: 'bg-estado-rechazado' },
}

function datos(estado: string) {
  return DATOS[estado as Estado] ?? { nombre: estado, color: '#475569', clase: 'bg-slate-600' }
}

export const nombreDeEstado = (estado: string) => datos(estado).nombre
export const colorDeEstado = (estado: string) => datos(estado).color
export const claseDeEstado = (estado: string) => datos(estado).clase
