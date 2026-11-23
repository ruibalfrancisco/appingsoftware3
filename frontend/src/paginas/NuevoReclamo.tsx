import { useMutation } from '@tanstack/react-query'
import { Check } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router'
import { Alerta, BotonPrincipal } from '../componentes/ui'
import { useSesion } from '../cuentas/api'
import { etiquetaGravedad } from '../dominio/gravedad'
import { crearReclamo, type Posicion, type TipoReclamo } from '../reclamos/api'
import IconoTipo from '../reclamos/IconoTipo'
import { DETALLES_INICIALES, type Detalles } from '../reclamos/detalles'
import {
  PasoDetalles,
  PasoFoto,
  PasoTipo,
  PasoUbicacion,
  type FotoElegida,
} from '../reclamos/pasos'

const PASOS = ['Tipo', 'Foto', 'Ubicación', 'Detalles', 'Resumen'] as const
type Paso = (typeof PASOS)[number]

const TITULOS: Record<Paso, string> = {
  Tipo: '¿Qué querés reportar?',
  Foto: 'Sacale una foto',
  Ubicación: '¿Dónde está?',
  Detalles: 'Contanos un poco más',
  Resumen: 'Revisá y enviá',
}

/** CU-04 Crear reclamo: una tarea por pantalla, con el paso a paso visible arriba. */
export default function NuevoReclamo() {
  const sesion = useSesion()
  const [paso, setPaso] = useState<Paso>('Tipo')
  const [tipo, setTipo] = useState<TipoReclamo>()
  const [foto, setFoto] = useState<FotoElegida>()
  const [posicion, setPosicion] = useState<Posicion>()
  const [detalles, setDetalles] = useState<Detalles>(DETALLES_INICIALES)
  const envio = useMutation({ mutationFn: crearReclamo })

  // Libera la memoria de la vista previa de la foto.
  useEffect(() => () => foto && URL.revokeObjectURL(foto.url), [foto])

  if (sesion.isPending)
    return <div className="m-4 h-40 animate-pulse rounded-tarjeta bg-slate-200" />
  if (!sesion.data) {
    return <Navigate to="/ingresar" replace state={{ aviso: 'Ingresá para cargar un reclamo.' }} />
  }

  if (envio.isSuccess) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 px-4 text-center">
        <div className="grid size-20 place-items-center rounded-full bg-green-100 text-exito-texto">
          <Check aria-hidden className="size-10" strokeWidth={3} />
        </div>
        <h1 className="font-display text-[28px] font-bold">¡Reclamo enviado!</h1>
        <p className="text-[17px] text-texto-2">
          Tu número de reclamo es <strong className="text-texto">#{envio.data.numero}</strong>. Te
          vamos a avisar cuando cambie de estado.
        </p>
        <Link
          to={`/reclamos/${envio.data.id}`}
          className="flex h-[52px] w-full items-center justify-center rounded-tarjeta bg-primario text-[17px] font-semibold text-white"
        >
          Ver mi reclamo
        </Link>
        <Link to="/" className="text-[17px] font-semibold text-primario">
          Volver al inicio
        </Link>
      </main>
    )
  }

  const indice = PASOS.indexOf(paso)
  const volver = () => setPaso(PASOS[indice - 1])

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 px-4 py-6">
      <header className="flex flex-col gap-3">
        {indice === 0 ? (
          <Link to="/" className="text-[15px] font-semibold text-primario">
            ← Cancelar
          </Link>
        ) : (
          <button
            type="button"
            onClick={volver}
            className="self-start text-[15px] font-semibold text-primario"
          >
            ← Atrás
          </button>
        )}
        <p className="text-[13px] font-semibold text-texto-2">
          Paso {indice + 1} de {PASOS.length} · {paso}
        </p>
        <div
          role="progressbar"
          aria-label="Avance del reclamo"
          aria-valuemin={1}
          aria-valuemax={PASOS.length}
          aria-valuenow={indice + 1}
          className="h-1.5 overflow-hidden rounded-full bg-slate-200"
        >
          <div
            className="h-full origin-left bg-primario transition-transform duration-300"
            style={{ transform: `scaleX(${(indice + 1) / PASOS.length})` }}
          />
        </div>
        <h1 className="font-display text-[22px] leading-tight font-bold">{TITULOS[paso]}</h1>
      </header>

      {paso === 'Tipo' && (
        <PasoTipo
          onElegir={(elegido) => {
            setTipo(elegido)
            setPaso('Foto')
          }}
        />
      )}
      {paso === 'Foto' && (
        <PasoFoto foto={foto} onFoto={setFoto} onSeguir={() => setPaso('Ubicación')} />
      )}
      {paso === 'Ubicación' && (
        <PasoUbicacion
          onConfirmar={(confirmada) => {
            setPosicion(confirmada)
            setPaso('Detalles')
          }}
        />
      )}
      {paso === 'Detalles' && (
        <PasoDetalles
          inicial={detalles}
          onSeguir={(cargados) => {
            setDetalles(cargados)
            setPaso('Resumen')
          }}
        />
      )}
      {paso === 'Resumen' && tipo && foto && posicion && (
        <section aria-label="Resumen del reclamo" className="flex flex-col gap-4">
          <img
            src={foto.url}
            alt="Foto del problema"
            className="h-48 w-full rounded-tarjeta object-cover"
          />
          <dl className="flex flex-col gap-3 rounded-tarjeta bg-superficie p-4 text-[15px] ring-1 ring-slate-200">
            <div className="flex items-center gap-2">
              <span style={{ color: tipo.color }}>
                <IconoTipo icono={tipo.icono} className="size-6" />
              </span>
              <dt className="sr-only">Tipo</dt>
              <dd className="font-semibold">{tipo.nombre}</dd>
            </div>
            <div>
              <dt className="text-[13px] text-texto-2">Título</dt>
              <dd className="font-semibold">{detalles.titulo}</dd>
            </div>
            {detalles.descripcion && (
              <div>
                <dt className="text-[13px] text-texto-2">Descripción</dt>
                <dd>{detalles.descripcion}</dd>
              </div>
            )}
            <div>
              <dt className="text-[13px] text-texto-2">Ubicación</dt>
              <dd>
                {detalles.direccion ||
                  `${posicion.latitud.toFixed(5)}, ${posicion.longitud.toFixed(5)}`}
              </dd>
            </div>
            <div>
              <dt className="text-[13px] text-texto-2">Gravedad</dt>
              <dd>
                {detalles.gravedad} · {etiquetaGravedad(detalles.gravedad)}
              </dd>
            </div>
          </dl>
          {envio.isError && <Alerta tipo="error">{envio.error.message}</Alerta>}
          <BotonPrincipal
            type="button"
            cargando={envio.isPending}
            onClick={() =>
              envio.mutate({ tipoId: tipo.id, foto: foto.blob, ...posicion, ...detalles })
            }
          >
            Enviar reclamo
          </BotonPrincipal>
        </section>
      )}
    </main>
  )
}
