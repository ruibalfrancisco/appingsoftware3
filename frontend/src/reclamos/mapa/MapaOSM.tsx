import { useEffect, useMemo, useState } from 'react'
import Map, { Layer, NavigationControl, Source, useMap } from 'react-map-gl/maplibre'
import type { PropsMapa } from './MapaSelector'
import BotonUbicarme from './BotonUbicarme'
import { ESTILO, TEXTOS } from './maplibre'
import PinCentral from './PinCentral'

// Un rectángulo que cubre el mundo; con el ejido como "agujero" oscurece todo lo de afuera.
const MUNDO = [
  [-180, -85],
  [180, -85],
  [180, 85],
  [-180, 85],
  [-180, -85],
]

/** Lleva el mapa al centro pedido (al abrir o con "Usar mi ubicación"), con una animación. */
function Centrar({ centro }: Pick<PropsMapa, 'centro'>) {
  const { current: mapa } = useMap()
  useEffect(() => {
    mapa?.flyTo({
      center: [centro.longitud, centro.latitud],
      zoom: Math.max(mapa.getZoom(), 16.5),
      duration: 700,
      essential: false, // con "reducir movimiento" salta sin animar
    })
  }, [mapa, centro])
  return null
}

/** RF-08 y RF-09: mapa con pin fijo en el centro y el ejido de Villa Allende resaltado. */
export default function MapaOSM({ centro, onCambio, ejido, dentro, onUbicarme }: PropsMapa) {
  const [moviendo, setMoviendo] = useState(false)
  const fueraDelEjido = useMemo(
    () => ({
      type: 'Feature' as const,
      properties: {},
      geometry: { type: 'Polygon' as const, coordinates: [MUNDO, ejido] },
    }),
    [ejido],
  )
  const borde = useMemo(
    () => ({
      type: 'Feature' as const,
      properties: {},
      geometry: { type: 'LineString' as const, coordinates: ejido },
    }),
    [ejido],
  )

  return (
    <div className="relative h-[55dvh] overflow-hidden rounded-hoja shadow-sm ring-1 ring-slate-300">
      <Map
        initialViewState={{ longitude: centro.longitud, latitude: centro.latitud, zoom: 17 }}
        mapStyle={ESTILO}
        locale={TEXTOS}
        style={{ width: '100%', height: '100%' }}
        attributionControl={{ compact: true }}
        dragRotate={false}
        touchPitch={false}
        pitchWithRotate={false}
        minZoom={12}
        onMoveStart={() => setMoviendo(true)}
        onMove={(evento) =>
          onCambio({ latitud: evento.viewState.latitude, longitud: evento.viewState.longitude })
        }
        onMoveEnd={() => setMoviendo(false)}
      >
        <Source id="fuera-del-ejido" type="geojson" data={fueraDelEjido}>
          <Layer
            id="fuera-del-ejido"
            type="fill"
            paint={{ 'fill-color': '#0F172A', 'fill-opacity': 0.28 }}
          />
        </Source>
        <Source id="borde-del-ejido" type="geojson" data={borde}>
          <Layer
            id="borde-del-ejido"
            type="line"
            paint={{ 'line-color': '#0F766E', 'line-width': 3, 'line-opacity': 0.9 }}
          />
        </Source>
        <NavigationControl position="top-right" showCompass={false} />
        <Centrar centro={centro} />
      </Map>
      <PinCentral dentro={dentro} moviendo={moviendo} />
      <BotonUbicarme onClick={onUbicarme} />
    </div>
  )
}
