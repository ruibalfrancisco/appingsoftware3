import { useEffect, useState } from 'react'

/** Devuelve `valor` recién cuando dejó de cambiar durante `ms` milisegundos (debounce). */
export function useValorEstable<T>(valor: T, ms: number): T {
  const [estable, setEstable] = useState(valor)
  useEffect(() => {
    const temporizador = setTimeout(() => setEstable(valor), ms)
    return () => clearTimeout(temporizador)
  }, [valor, ms])
  return estable
}
