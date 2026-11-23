import { z } from 'zod'

/** RF-14: título hasta 80, descripción hasta 500, gravedad del 1 al 10 (RN-03). */
export const esquemaDetalles = z.object({
  titulo: z.string().trim().min(1, 'Poné un título corto').max(80, 'Hasta 80 caracteres'),
  descripcion: z.string().trim().max(500, 'Hasta 500 caracteres'),
  direccion: z.string().trim().max(200, 'Hasta 200 caracteres'),
  gravedad: z.number().int().min(1).max(10),
})
export type Detalles = z.output<typeof esquemaDetalles>

export const DETALLES_INICIALES: Detalles = {
  titulo: '',
  descripcion: '',
  direccion: '',
  gravedad: 5,
}

/** Verde (leve) a rojo (urgente), siempre con contraste suficiente para texto blanco. */
export function colorGravedad(gravedad: number): string {
  const tono = 140 - ((gravedad - 1) / 9) * 140
  return `hsl(${tono.toFixed(0)} 75% 30%)`
}
