import { lazy, Suspense } from 'react'
import MapaDeReclamosSimulado from './MapaDeReclamosSimulado'
import type { PropsMapaDeReclamos } from './pines'

// MapLibre se descarga recién cuando hace falta un mapa (lo comparte con el de ubicación).
const MapaDeReclamosOSM = lazy(() => import('./MapaDeReclamosOSM'))

/**
 * Los reclamos como pines sobre el mapa de OpenStreetMap. Con VITE_MAPA=simulado (CI y
 * pruebas), un mapa simulado con el mismo contrato, sin red.
 */
export default function MapaDeReclamos(props: PropsMapaDeReclamos) {
  if (import.meta.env.VITE_MAPA === 'simulado') return <MapaDeReclamosSimulado {...props} />
  return (
    <Suspense fallback={<div className={`animate-pulse bg-slate-200 ${props.className}`} />}>
      <MapaDeReclamosOSM {...props} />
    </Suspense>
  )
}
