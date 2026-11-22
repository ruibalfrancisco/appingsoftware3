import { useEffect, useState } from 'react'
import { obtenerSalud, type Salud } from './api'

type EstadoApi = { tipo: 'cargando' } | { tipo: 'ok'; salud: Salud } | { tipo: 'error' }

export default function App() {
  const [estado, setEstado] = useState<EstadoApi>({ tipo: 'cargando' })

  useEffect(() => {
    const control = new AbortController()
    obtenerSalud(control.signal)
      .then((salud) => setEstado({ tipo: 'ok', salud }))
      .catch((error: unknown) => {
        if (!control.signal.aborted) {
          console.error(error)
          setEstado({ tipo: 'error' })
        }
      })
    return () => control.abort()
  }, [])

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-4 py-12">
      <header className="flex flex-col gap-2">
        <p className="text-[13px] font-semibold tracking-wide text-primario uppercase">
          Municipalidad de Villa Allende
        </p>
        <h1 className="font-display text-[28px] leading-tight font-bold">Reclamos Villa Allende</h1>
        <p className="text-[17px] text-texto-2">
          Reportá baches, luminarias rotas y otros problemas de tu barrio con una foto y su
          ubicación.
        </p>
      </header>

      <section
        aria-labelledby="titulo-estado"
        className="rounded-tarjeta bg-superficie p-4 shadow-sm ring-1 ring-slate-200"
      >
        <h2 id="titulo-estado" className="font-display text-[17px] font-semibold">
          Estado del sistema
        </h2>
        <div role="status" aria-live="polite" className="mt-2 text-[15px]">
          {estado.tipo === 'cargando' && <p className="text-texto-2">Conectando con la API…</p>}
          {estado.tipo === 'ok' && (
            <p>
              <span className="font-semibold text-exito-texto">API conectada</span>
              <span className="text-texto-2">
                {' '}
                · v{estado.salud.version} · {estado.salud.ambiente}
              </span>
            </p>
          )}
          {estado.tipo === 'error' && (
            <p className="font-semibold text-error">No se pudo conectar con la API</p>
          )}
        </div>
      </section>
    </main>
  )
}
