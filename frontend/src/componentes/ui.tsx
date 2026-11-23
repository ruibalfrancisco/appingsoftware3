import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, Ref } from 'react'
import { Link } from 'react-router'

/** Una tarea por pantalla, con el título arriba y la acción principal abajo (guía visual). */
export function Pantalla({
  titulo,
  bajada,
  volverA,
  children,
}: {
  titulo: string
  bajada?: ReactNode
  volverA?: string
  children: ReactNode
}) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-4 py-8">
      {volverA && (
        <Link to={volverA} className="text-[15px] font-semibold text-primario">
          ← Volver
        </Link>
      )}
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-[28px] leading-tight font-bold">{titulo}</h1>
        {bajada && <p className="text-[17px] text-texto-2">{bajada}</p>}
      </header>
      {children}
    </main>
  )
}

interface PropsCampo extends InputHTMLAttributes<HTMLInputElement> {
  ref?: Ref<HTMLInputElement>
  etiqueta: string
  error?: string
  ayuda?: string
}

/** Campo con etiqueta y error asociados para lectores de pantalla (RNF-06). */
export function Campo({ ref, etiqueta, error, ayuda, id, name, ...props }: PropsCampo) {
  const idCampo = id ?? name
  const idAyuda = `${idCampo}-ayuda`
  const idError = `${idCampo}-error`
  // Con error, el error reemplaza a la ayuda.
  const describedBy = error ? idError : ayuda ? idAyuda : undefined
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={idCampo} className="text-[15px] font-semibold">
        {etiqueta}
      </label>
      <input
        ref={ref}
        id={idCampo}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className="h-12 rounded-tarjeta border border-slate-300 bg-superficie px-3 text-[17px] outline-none focus:border-primario focus:ring-2 focus:ring-primario/30 aria-invalid:border-error"
        {...props}
      />
      {ayuda && !error && (
        <p id={idAyuda} className="text-[13px] text-texto-2">
          {ayuda}
        </p>
      )}
      {error && (
        <p id={idError} className="text-[13px] font-semibold text-error">
          {error}
        </p>
      )}
    </div>
  )
}

export function BotonPrincipal({
  cargando,
  children,
  ...props
}: { cargando?: boolean } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="submit"
      {...props}
      disabled={cargando || props.disabled}
      aria-busy={cargando || undefined}
      className="h-[52px] w-full rounded-tarjeta bg-primario text-[17px] font-semibold text-white transition-transform active:scale-[0.98] disabled:opacity-60"
    >
      {cargando ? 'Un momento…' : children}
    </button>
  )
}

export function Alerta({ tipo, children }: { tipo: 'error' | 'exito'; children: ReactNode }) {
  const estilos =
    tipo === 'error'
      ? 'border-error/30 bg-red-50 text-error'
      : 'border-exito-texto/30 bg-green-50 text-exito-texto'
  return (
    <div
      role={tipo === 'error' ? 'alert' : 'status'}
      className={`rounded-tarjeta border p-3 text-[15px] font-semibold ${estilos}`}
    >
      {children}
    </div>
  )
}
