import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { Link } from 'react-router'
import { obtenerSalud } from '../api'
import { CLAVE_SESION, cuentas, useSesion } from '../cuentas/api'

function EstadoDelSistema() {
  const salud = useQuery({ queryKey: ['salud'], queryFn: ({ signal }) => obtenerSalud(signal) })
  return (
    <section
      aria-labelledby="titulo-estado"
      className="rounded-tarjeta bg-superficie p-4 shadow-sm ring-1 ring-slate-200"
    >
      <h2 id="titulo-estado" className="font-display text-[17px] font-semibold">
        Estado del sistema
      </h2>
      <div role="status" aria-live="polite" className="mt-2 text-[15px]">
        {salud.isPending && <p className="text-texto-2">Conectando con la API…</p>}
        {salud.isSuccess && (
          <p>
            <span className="font-semibold text-exito-texto">API conectada</span>
            <span className="text-texto-2">
              {' '}
              · v{salud.data.version} · {salud.data.ambiente}
            </span>
          </p>
        )}
        {salud.isError && (
          <p className="font-semibold text-error">No se pudo conectar con la API</p>
        )}
      </div>
    </section>
  )
}

const claseBoton =
  'flex h-[52px] items-center justify-center rounded-tarjeta text-[17px] font-semibold'

export default function Inicio() {
  const sesion = useSesion()
  const clienteQuery = useQueryClient()
  const salida = useMutation({
    mutationFn: cuentas.salir,
    onSuccess: () => clienteQuery.setQueryData(CLAVE_SESION, null),
  })
  const usuario = sesion.data

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-4 py-12">
      <header className="flex flex-col gap-2">
        <p className="text-[13px] font-semibold tracking-wide text-primario uppercase">
          Municipalidad de Villa Allende
        </p>
        <h1 className="font-display text-[28px] leading-tight font-bold">
          {usuario ? `Hola, ${usuario.nombre}` : 'Reclamos Villa Allende'}
        </h1>
        <p className="text-[17px] text-texto-2">
          Reportá baches, luminarias rotas y otros problemas de tu barrio con una foto y su
          ubicación.
        </p>
      </header>

      {sesion.isPending && <div className="h-[116px] animate-pulse rounded-tarjeta bg-slate-200" />}

      {sesion.isSuccess && !usuario && (
        <nav aria-label="Cuenta" className="flex flex-col gap-3">
          <Link to="/registro" className={`${claseBoton} bg-primario text-white`}>
            Crear cuenta
          </Link>
          <Link to="/ingresar" className={`${claseBoton} border border-primario text-primario`}>
            Ya tengo cuenta
          </Link>
        </nav>
      )}

      {usuario && (
        <div className="flex flex-col gap-3">
          <Link to="/reclamos/nuevo" className={`${claseBoton} gap-2 bg-primario text-white`}>
            <Plus aria-hidden className="size-5" strokeWidth={2.5} /> Nuevo reclamo
          </Link>
          <button
            type="button"
            onClick={() => salida.mutate()}
            className={`${claseBoton} border border-slate-300 text-texto`}
          >
            Cerrar sesión
          </button>
        </div>
      )}

      <EstadoDelSistema />
    </main>
  )
}
