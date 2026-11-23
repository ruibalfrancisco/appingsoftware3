import { z } from 'zod'

/**
 * RF-14: descripción obligatoria hasta 500, gravedad del 1 al 10 (RN-03). No hay título: el
 * reclamo se nombra por su tipo y su dirección.
 */
export const esquemaDetalles = z.object({
  descripcion: z
    .string()
    .trim()
    .min(1, 'Escribí qué pasa, aunque sea en pocas palabras')
    .max(500, 'Hasta 500 caracteres'),
  direccion: z.string().trim().max(200, 'Hasta 200 caracteres'),
  gravedad: z.number().int().min(1).max(10),
})
export type Detalles = z.output<typeof esquemaDetalles>

export const DETALLES_INICIALES: Detalles = {
  descripcion: '',
  direccion: '',
  gravedad: 5,
}

/** Verde (leve) a rojo (urgente), siempre con contraste suficiente para texto blanco. */
export function colorGravedad(gravedad: number): string {
  const tono = 140 - ((gravedad - 1) / 9) * 140
  return `hsl(${tono.toFixed(0)} 75% 30%)`
}
