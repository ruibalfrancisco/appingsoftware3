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
  onUbicarme: () => void
}

// El mapa real (MapLibre, ~200 KB comprimido) se descarga recién en el paso de ubicación.
const MapaOSM = lazy(() => import('./MapaOSM'))

/**
 * Mapa real de OpenStreetMap, salvo con VITE_MAPA=simulado (CI y pruebas): ahí un mapa
 * simulado que se maneja con botones y teclado, sin red y sin depender de terceros.
 */
export default function MapaSelector(props: PropsMapa) {
  if (import.meta.env.VITE_MAPA === 'simulado') {
    return <MapaSimulado key={`${props.centro.latitud},${props.centro.longitud}`} {...props} />
  }
  return (
    <Suspense fallback={<div className="h-[55dvh] animate-pulse rounded-hoja bg-slate-200" />}>
      <MapaOSM {...props} />
    </Suspense>
  )
}
