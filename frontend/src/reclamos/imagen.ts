export const LADO_MAXIMO = 1600
export const PESO_MAXIMO = 10 * 1024 * 1024
export const TIPOS_ACEPTADOS = ['image/jpeg', 'image/png', 'image/webp']

/** Tamaño final manteniendo la proporción; nunca agranda. */
export function dimensionesReducidas(ancho: number, alto: number, maximo = LADO_MAXIMO) {
  const escala = Math.min(1, maximo / Math.max(ancho, alto))
  return { ancho: Math.round(ancho * escala), alto: Math.round(alto * escala) }
}

export function validarArchivo(archivo: File): string | null {
  if (!TIPOS_ACEPTADOS.includes(archivo.type)) return 'La foto tiene que ser JPG, PNG o WEBP'
  if (archivo.size > PESO_MAXIMO) return 'La foto puede pesar hasta 10 MB'
  return null
}

/**
 * RN-10: el celular reduce la foto a 1600 px antes de subirla (menos datos móviles y subida
 * más rápida). El backend igual la vuelve a procesar y le borra el EXIF.
 */
export async function reducirFoto(archivo: File): Promise<Blob> {
  const bitmap = await createImageBitmap(archivo, { imageOrientation: 'from-image' })
  const { ancho, alto } = dimensionesReducidas(bitmap.width, bitmap.height)
  const lienzo = document.createElement('canvas')
  lienzo.width = ancho
  lienzo.height = alto
  lienzo.getContext('2d')?.drawImage(bitmap, 0, 0, ancho, alto)
  bitmap.close()
  return new Promise((resolver, rechazar) =>
    lienzo.toBlob(
      (blob) => (blob ? resolver(blob) : rechazar(new Error('No se pudo procesar la foto'))),
      'image/jpeg',
      0.85,
    ),
  )
}
