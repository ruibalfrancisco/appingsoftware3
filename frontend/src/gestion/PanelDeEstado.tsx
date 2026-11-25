import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ImagePlus } from 'lucide-react'
import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { Alerta, BotonPrincipal } from '../componentes/ui'
import { nombreDeEstado } from '../reclamos/estados'
import { fechaYHora } from '../reclamos/formato'
import { reducirFoto, validarArchivo } from '../reclamos/imagen'
import { cambiarEstado, useAreas, type CambioRegistrado, type ReclamoDeGestion } from './api'

const ACCIONES: Record<string, string> = {
  EN_REVISION: 'Pasar a En revisión',
  EN_PROCESO: 'Pasar a En proceso',
  RESUELTO: 'Resolver',
  RECHAZADO: 'Rechazar',
}

const ETIQUETAS: Record<string, string> = {
  EN_REVISION: 'Comentario (opcional)',
  EN_PROCESO: 'Comentario (opcional)',
  RESUELTO: 'Qué se hizo',
  RECHAZADO: 'Motivo del rechazo',
}

function FormularioDeEstado({
  reclamo,
  destino,
  onListo,
}: {
  reclamo: ReclamoDeGestion
  destino: string
  onListo: (registrado: CambioRegistrado) => void
}) {
  const areas = useAreas()
  const clienteQuery = useQueryClient()
  const [comentario, setComentario] = useState('')
  const [areaId, setAreaId] = useState(reclamo.area ? String(reclamo.area.id) : '')
  const [foto, setFoto] = useState<{ blob: Blob; url: string }>()
  const [error, setError] = useState<string>()
  const cambio = useMutation({
    mutationFn: () =>
      cambiarEstado(reclamo.id, {
        estado: destino,
        comentario: comentario.trim() || undefined,
        areaId: areaId ? Number(areaId) : undefined,
        foto: foto?.blob,
      }),
    onSuccess: async (registrado) => {
      await clienteQuery.invalidateQueries({ queryKey: ['gestion'] })
      onListo(registrado)
    },
  })
  useEffect(() => () => foto && URL.revokeObjectURL(foto.url), [foto])

  // RN-05 / CU-08 paso 2: lo mismo que exige el backend, para avisar antes de enviar.
  const pideArea = destino === 'EN_PROCESO'
  const pideComentario = destino === 'RESUELTO' || destino === 'RECHAZADO'

  const enviar = (evento: FormEvent) => {
    evento.preventDefault()
    if (pideArea && !areaId) return setError('Elegí el área responsable')
    if (pideComentario && !comentario.trim()) {
      return setError(
        destino === 'RECHAZADO' ? 'Escribí el motivo del rechazo' : 'Contá qué se hizo',
      )
    }
    setError(undefined)
    cambio.mutate()
  }

  const alElegirFoto = async (evento: ChangeEvent<HTMLInputElement>) => {
    const archivo = evento.target.files?.[0]
    evento.target.value = ''
    if (!archivo) return
    const problema = validarArchivo(archivo)
    if (problema) return setError(problema)
    setError(undefined)
    const blob = await reducirFoto(archivo).catch(() => archivo)
    setFoto({ blob, url: URL.createObjectURL(blob) })
  }

  const claseCampo =
    'rounded-tarjeta border border-slate-300 bg-superficie px-3 text-[15px] outline-none focus:border-primario focus:ring-2 focus:ring-primario/30'

  return (
    <form
      noValidate
      onSubmit={enviar}
      aria-label={ACCIONES[destino]}
      className="flex flex-col gap-3 rounded-tarjeta bg-fondo p-3 ring-1 ring-slate-200"
    >
      {pideArea && (
        <div className="flex flex-col gap-1">
          <label htmlFor="area" className="text-[15px] font-semibold">
            Área responsable
          </label>
          <select
            id="area"
            value={areaId}
            onChange={(e) => setAreaId(e.target.value)}
            className={`h-11 ${claseCampo}`}
          >
            <option value="">Elegí un área</option>
            {areas.data?.map((area) => (
              <option key={area.id} value={area.id}>
                {area.nombre}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="flex flex-col gap-1">
        <label htmlFor="comentario" className="text-[15px] font-semibold">
          {ETIQUETAS[destino]}
        </label>
        <textarea
          id="comentario"
          rows={3}
          maxLength={500}
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          className={`py-2 ${claseCampo}`}
        />
        {pideComentario && (
          <p className="text-[13px] text-texto-2">Lo ven el vecino y quienes lo apoyaron.</p>
        )}
      </div>
      {destino === 'RESUELTO' && (
        <div className="flex flex-col gap-2">
          <span className="text-[15px] font-semibold">Foto del después (opcional)</span>
          {foto && (
            <img
              src={foto.url}
              alt="Foto del después"
              className="h-32 w-full rounded-tarjeta object-cover"
            />
          )}
          <label className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-tarjeta border border-dashed border-slate-400 text-[15px] font-semibold text-primario">
            <ImagePlus aria-hidden className="size-5" />
            {foto ? 'Cambiar la foto' : 'Elegir la foto del después'}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(e) => void alElegirFoto(e)}
            />
          </label>
        </div>
      )}
      {(error || cambio.isError) && <Alerta tipo="error">{error ?? cambio.error?.message}</Alerta>}
      <BotonPrincipal cargando={cambio.isPending}>Confirmar: {ACCIONES[destino]}</BotonPrincipal>
    </form>
  )
}

/** CU-08: desde el detalle, los cambios permitidos por RN-05 y lo que exige cada uno. */
export default function PanelDeEstado({ reclamo }: { reclamo: ReclamoDeGestion }) {
  const [destino, setDestino] = useState<string>()
  const [aviso, setAviso] = useState<string>()

  return (
    <section
      aria-labelledby="titulo-cambio"
      className="flex flex-col gap-3 rounded-tarjeta bg-superficie p-4 shadow-sm ring-1 ring-slate-200"
    >
      <h2 id="titulo-cambio" className="font-display text-[17px] font-semibold">
        Cambiar estado
      </h2>
      {aviso && <Alerta tipo="exito">{aviso}</Alerta>}
      {reclamo.transiciones.length === 0 ? (
        <p className="text-[15px] text-texto-2">
          El reclamo está cerrado ({nombreDeEstado(reclamo.estado)}
          {reclamo.cerrado_en && ` el ${fechaYHora(reclamo.cerrado_en)}`}): ya no cambia de estado.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {reclamo.transiciones.map((estado) => (
              <button
                key={estado}
                type="button"
                aria-pressed={destino === estado}
                onClick={() => {
                  setAviso(undefined)
                  setDestino(estado)
                }}
                className={`h-10 rounded-full border px-4 text-[15px] font-semibold ${
                  destino === estado
                    ? 'border-primario bg-primario text-white'
                    : estado === 'RECHAZADO'
                      ? 'border-error/40 text-error'
                      : 'border-slate-300'
                }`}
              >
                {ACCIONES[estado]}
              </button>
            ))}
          </div>
          {destino && (
            <FormularioDeEstado
              key={destino}
              reclamo={reclamo}
              destino={destino}
              onListo={(registrado) => {
                setDestino(undefined)
                const vecinos = registrado.notificados === 1 ? 'vecino' : 'vecinos'
                setAviso(
                  `Listo: pasó a ${nombreDeEstado(registrado.estado)}. ` +
                    `Le avisamos a ${registrado.notificados} ${vecinos}.`,
                )
              }}
            />
          )}
        </>
      )}
    </section>
  )
}
