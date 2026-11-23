import { lazy, Suspense } from 'react'
import type { Posicion } from '../api'
import type { Anillo } from '../geocerca'
import MapaSimulado from './MapaSimulado'

export interface PropsMapa {
  /** Adónde llevar el mapa (al abrir o con "Usar mi ubicación"). */
  centro: Posicion
  /** Se llama cada vez que el pin fijo del centro queda sobre otro punto. */
  onCambio: (posicion: Posicion) => void
  ejido: Anillo
  dentro: boolean
}

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY

// Google Maps solo se descarga si hay key: el resto de la app no carga ese código.
const MapaGoogle = lazy(() => import('./MapaGoogle'))

/**
 * Con key, Google Maps. Sin key (CI, o en local antes de configurarla), un mapa simulado que
 * se maneja con botones y teclado: las pruebas E2E no gastan cuota ni dependen de la red.
 */
export default function MapaSelector(props: PropsMapa) {
  if (!API_KEY) {
    return <MapaSimulado key={`${props.centro.latitud},${props.centro.longitud}`} {...props} />
  }
  return (
    <Suspense fallback={<div className="h-[55dvh] animate-pulse rounded-hoja bg-slate-200" />}>
      <MapaGoogle apiKey={API_KEY} {...props} />
    </Suspense>
  )
}
