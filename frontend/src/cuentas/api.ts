import { useQuery } from '@tanstack/react-query'
import { ErrorDeApi, pedir } from '../api'
import type { Ingreso, Registro } from './esquemas'

export interface Usuario {
  id: number
  nombre: string
  apellido: string
  email: string
  rol: 'vecino' | 'operador' | 'admin'
  email_verificado: boolean
}

interface Aviso {
  mensaje: string
}

const post = <T>(ruta: string, cuerpo?: unknown) => pedir<T>(ruta, { metodo: 'POST', cuerpo })

export const cuentas = {
  registrar: (datos: Registro) => post<Aviso>('/auth/registro', datos),
  verificar: (token: string) => post<Usuario>('/auth/verificar', { token }),
  reenviarVerificacion: (email: string) => post<Aviso>('/auth/reenviar-verificacion', { email }),
  ingresar: (datos: Ingreso) => post<Usuario>('/auth/ingreso', datos),
  salir: () => post<void>('/auth/salir'),
  recuperar: (email: string) => post<Aviso>('/auth/recuperar', { email }),
  restablecer: (token: string, password: string) =>
    post<Aviso>('/auth/restablecer', { token, password }),
}

export const CLAVE_SESION = ['sesion'] as const

/** Usuario con sesión iniciada, o null si no hay sesión. */
export function useSesion() {
  return useQuery({
    queryKey: CLAVE_SESION,
    queryFn: async ({ signal }) => {
      try {
        return await pedir<Usuario>('/auth/yo', { signal })
      } catch (error) {
        if (error instanceof ErrorDeApi && error.status === 401) return null
        throw error
      }
    },
    staleTime: 60_000,
  })
}
