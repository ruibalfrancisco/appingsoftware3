import { useMutation, useQueryClient } from '@tanstack/react-query'
import { LogOut } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, Navigate } from 'react-router'
import { Alerta, Pantalla } from '../componentes/ui'
import { CLAVE_SESION, cuentas, useSesion } from '../cuentas/api'

const ROLES = { operador: 'Operador', admin: 'Administrador' } as const

/**
 * Encabezado y control de acceso del back office. El backend ya responde 403 a un vecino;
 * esto es para que la interfaz no le muestre pantallas vacías (IT-07 del lado web).
 */
export default function MarcoMunicipal({ children }: { children: ReactNode }) {
  const sesion = useSesion()
  const clienteQuery = useQueryClient()
  const salida = useMutation({
    mutationFn: cuentas.salir,
    onSuccess: () => clienteQuery.setQueryData(CLAVE_SESION, null),
  })

  if (sesion.isPending) {
    return <div className="m-4 h-40 animate-pulse rounded-tarjeta bg-slate-200" />
  }
  const usuario = sesion.data
  if (!usuario) {
    return (
      <Navigate to="/ingresar" replace state={{ aviso: 'Ingresá con tu usuario municipal.' }} />
    )
  }
  if (usuario.rol === 'vecino') {
    return (
      <Pantalla titulo="Solo personal municipal" volverA="/">
        <Alerta tipo="error">Esta sección es para el personal de la Municipalidad.</Alerta>
      </Pantalla>
    )
  }

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-superficie/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <Link to="/tablero" className="flex flex-col leading-tight">
            <span className="text-[12px] font-semibold tracking-wide text-primario uppercase">
              Municipalidad de Villa Allende
            </span>
            <span className="font-display text-[19px] font-bold">Tablero de reclamos</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-right text-[13px] leading-tight text-texto-2 sm:block">
              <span className="block font-semibold text-texto">
                {usuario.nombre} {usuario.apellido}
              </span>
              {ROLES[usuario.rol]}
            </span>
            <button
              type="button"
              onClick={() => salida.mutate()}
              className="flex h-10 items-center gap-2 rounded-tarjeta border border-slate-300 px-3 text-[15px] font-semibold"
            >
              <LogOut aria-hidden className="size-4" /> Salir
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4">{children}</main>
    </div>
  )
}
