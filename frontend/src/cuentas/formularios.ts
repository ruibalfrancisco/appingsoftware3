import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import { ERROR_GENERICO, ErrorDeApi } from '../api'

/**
 * Lleva los errores de la API al formulario: los de cada campo, junto al campo; el resto,
 * como mensaje general. Devuelve el mensaje general para mostrarlo arriba del botón.
 */
export function aplicarErrores<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  camposDelFormulario: readonly Path<T>[],
): string {
  if (!(error instanceof ErrorDeApi)) return ERROR_GENERICO
  for (const [campo, mensaje] of Object.entries(error.campos)) {
    if ((camposDelFormulario as readonly string[]).includes(campo)) {
      setError(campo as Path<T>, { message: mensaje })
    }
  }
  return error.message
}
