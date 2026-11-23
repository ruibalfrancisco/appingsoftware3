import { zodResolver } from '@hookform/resolvers/zod'
import { Camera, Images, LocateFixed, RotateCcw } from 'lucide-react'
import { useCallback, useEffect, useState, type ChangeEvent } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Alerta, BotonPrincipal, Campo } from '../componentes/ui'
import { etiquetaGravedad } from '../dominio/gravedad'
import type { Posicion, TipoReclamo } from './api'
import { useEjido, useTipos } from './api'
import { colorGravedad, esquemaDetalles, type Detalles } from './detalles'
import { dentroDelEjido } from './geocerca'
import IconoTipo from './IconoTipo'
import { reducirFoto, validarArchivo } from './imagen'
import MapaSelector from './mapa/MapaSelector'

/* ---------- Paso 1: tipo (RF-06) ---------- */

export function PasoTipo({ onElegir }: { onElegir: (tipo: TipoReclamo) => void }) {
  const tipos = useTipos()
  if (tipos.isPending) {
    return <div className="h-80 animate-pulse rounded-tarjeta bg-slate-200" />
  }
  if (tipos.isError) return <Alerta tipo="error">{tipos.error.message}</Alerta>
  return (
    <ul className="grid grid-cols-2 gap-3">
      {tipos.data.map((tipo) => (
        <li key={tipo.id}>
          <button
            type="button"
            onClick={() => onElegir(tipo)}
            className="flex h-32 w-full flex-col items-center justify-center gap-2 rounded-tarjeta bg-superficie p-3 text-center text-[15px] font-semibold shadow-sm ring-1 ring-slate-200 transition-transform active:scale-95"
          >
            <span style={{ color: tipo.color }}>
              <IconoTipo icono={tipo.icono} className="size-10" />
            </span>
            {tipo.nombre}
          </button>
        </li>
      ))}
    </ul>
  )
}

/* ---------- Paso 2: foto (RF-07, RN-10) ---------- */

export interface FotoElegida {
  blob: Blob
  url: string
}

export function PasoFoto({
  foto,
  onFoto,
  onSeguir,
}: {
  foto?: FotoElegida
  onFoto: (foto: FotoElegida | undefined) => void
  onSeguir: () => void
}) {
  const [error, setError] = useState<string>()
  const [procesando, setProcesando] = useState(false)

  const alElegir = async (evento: ChangeEvent<HTMLInputElement>) => {
    const archivo = evento.target.files?.[0]
    evento.target.value = '' // permite elegir la misma foto otra vez
    if (!archivo) return
    const problema = validarArchivo(archivo)
    if (problema) {
      setError(problema)
      return
    }
    setError(undefined)
    setProcesando(true)
    // Si el navegador no puede reducirla, se sube como está: el backend la procesa igual.
    const blob = await reducirFoto(archivo).catch(() => archivo)
    setProcesando(false)
    onFoto({ blob, url: URL.createObjectURL(blob) })
  }

  const claseBoton =
    'flex h-[52px] cursor-pointer items-center justify-center gap-2 rounded-tarjeta text-[17px] font-semibold'

  if (foto) {
    return (
      <div className="flex flex-col gap-4">
        <img
          src={foto.url}
          alt="Foto del problema"
          className="max-h-[50dvh] w-full rounded-tarjeta object-cover"
        />
        <BotonPrincipal type="button" onClick={onSeguir}>
          Usar esta foto
        </BotonPrincipal>
        <button
          type="button"
          onClick={() => onFoto(undefined)}
          className={`${claseBoton} border border-slate-300`}
        >
          <RotateCcw aria-hidden className="size-5" /> Sacar otra
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[15px] text-texto-2">
        Una foto clara ayuda a que la Municipalidad lo encuentre y lo arregle más rápido.
      </p>
      <label className={`${claseBoton} bg-primario text-white`}>
        <Camera aria-hidden className="size-5" /> Sacar foto
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={alElegir}
        />
      </label>
      <label className={`${claseBoton} border border-primario text-primario`}>
        <Images aria-hidden className="size-5" /> Elegir de la galería
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={alElegir}
        />
      </label>
      {procesando && <p role="status">Preparando la foto…</p>}
      {error && <Alerta tipo="error">{error}</Alerta>}
    </div>
  )
}

/* ---------- Paso 3: ubicación (RF-08, RF-09, RN-06) ---------- */

function pedirUbicacion(): Promise<Posicion> {
  return new Promise((resolver, rechazar) => {
    if (!('geolocation' in navigator)) {
      rechazar(new Error('sin geolocalización'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolver({ latitud: coords.latitude, longitud: coords.longitude }),
      rechazar,
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30_000 },
    )
  })
}

export function PasoUbicacion({ onConfirmar }: { onConfirmar: (posicion: Posicion) => void }) {
  const ejido = useEjido()
  const [centro, setCentro] = useState<Posicion>()
  const [posicion, setPosicion] = useState<Posicion>()
  const [sinGps, setSinGps] = useState(false)

  const ubicar = useCallback(
    (respaldo: Posicion) =>
      pedirUbicacion()
        .then((p) => {
          setSinGps(false)
          setCentro(p)
          setPosicion(p)
        })
        .catch(() => {
          // CU-04 3a: sin permiso o sin señal, el mapa abre en Villa Allende.
          setSinGps(true)
          setCentro(respaldo)
          setPosicion(respaldo)
        }),
    [],
  )

  const respaldo = ejido.data?.centro
  useEffect(() => {
    if (respaldo) void ubicar(respaldo)
  }, [respaldo, ubicar])

  if (ejido.isError) return <Alerta tipo="error">{ejido.error.message}</Alerta>
  if (!ejido.data || !centro || !posicion) {
    return (
      <p role="status" className="text-[17px] text-texto-2">
        Buscando tu ubicación…
      </p>
    )
  }

  const anillo = ejido.data.geojson.features[0].geometry.coordinates[0]
  const dentro = dentroDelEjido(posicion, anillo)

  return (
    <div className="flex flex-col gap-3">
      {sinGps && (
        <p role="status" className="text-[15px] text-texto-2">
          No pudimos usar tu ubicación. Mové el mapa hasta el lugar del problema.
        </p>
      )}
      <MapaSelector centro={centro} onCambio={setPosicion} ejido={anillo} dentro={dentro} />
      <button
        type="button"
        onClick={() => void ubicar(ejido.data.centro)}
        className="flex items-center justify-center gap-2 text-[15px] font-semibold text-primario"
      >
        <LocateFixed aria-hidden className="size-5" /> Usar mi ubicación
      </button>
      {!dentro && <Alerta tipo="error">Esta ubicación está fuera de Villa Allende</Alerta>}
      <BotonPrincipal type="button" disabled={!dentro} onClick={() => onConfirmar(posicion)}>
        Confirmar ubicación
      </BotonPrincipal>
    </div>
  )
}

/* ---------- Paso 4: detalles (RF-14) ---------- */

export function PasoDetalles({
  inicial,
  onSeguir,
}: {
  inicial: Detalles
  onSeguir: (detalles: Detalles) => void
}) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<Detalles>({ resolver: zodResolver(esquemaDetalles), defaultValues: inicial })
  const gravedad = useWatch({ control, name: 'gravedad' })

  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={handleSubmit(onSeguir)}>
      <Campo
        etiqueta="Título"
        ayuda="Por ejemplo: Bache grande frente a la escuela"
        maxLength={80}
        error={errors.titulo?.message}
        {...register('titulo')}
      />
      <div className="flex flex-col gap-1">
        <label htmlFor="descripcion" className="text-[15px] font-semibold">
          Descripción <span className="font-normal text-texto-2">(opcional)</span>
        </label>
        <textarea
          id="descripcion"
          rows={3}
          maxLength={500}
          className="rounded-tarjeta border border-slate-300 bg-superficie p-3 text-[17px] outline-none focus:border-primario focus:ring-2 focus:ring-primario/30"
          {...register('descripcion')}
        />
      </div>
      <Campo
        etiqueta="Dirección o referencia (opcional)"
        maxLength={200}
        error={errors.direccion?.message}
        {...register('direccion')}
      />
      <div className="flex flex-col gap-2">
        <label
          htmlFor="gravedad"
          className="flex items-center justify-between text-[15px] font-semibold"
        >
          ¿Qué tan grave es?
          <span
            className="rounded-full px-3 py-1 text-[13px] text-white"
            style={{ backgroundColor: colorGravedad(gravedad) }}
          >
            {gravedad} · {etiquetaGravedad(gravedad)}
          </span>
        </label>
        <input
          id="gravedad"
          type="range"
          min={1}
          max={10}
          step={1}
          aria-valuetext={`${gravedad}, ${etiquetaGravedad(gravedad)}`}
          className="w-full accent-primario"
          {...register('gravedad', { valueAsNumber: true })}
        />
        <div className="flex justify-between text-[13px] text-texto-2" aria-hidden>
          <span>Leve</span>
          <span>Urgente</span>
        </div>
      </div>
      <BotonPrincipal>Revisar</BotonPrincipal>
    </form>
  )
}
