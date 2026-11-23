import { APIProvider, Map, Polygon, useMap } from '@vis.gl/react-google-maps'
import { useEffect, useMemo } from 'react'
import type { PropsMapa } from './MapaSelector'
import PinCentral from './PinCentral'

const MAP_ID = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID'

/** Lleva el mapa al centro pedido (al abrir o con "Usar mi ubicación"). */
function Centrar({ centro }: Pick<PropsMapa, 'centro'>) {
  const mapa = useMap()
  useEffect(() => {
    mapa?.panTo({ lat: centro.latitud, lng: centro.longitud })
  }, [mapa, centro])
  return null
}

/** RF-08 y RF-09: Google Maps con el pin fijo en el centro y el ejido sombreado. */
export default function MapaGoogle({
  apiKey,
  centro,
  onCambio,
  ejido,
  dentro,
}: PropsMapa & { apiKey: string }) {
  const contorno = useMemo(() => ejido.map(([lng, lat]) => ({ lat, lng })), [ejido])

  return (
    <APIProvider apiKey={apiKey} language="es" region="AR">
      <div className="relative h-[55dvh] overflow-hidden rounded-hoja ring-1 ring-slate-300">
        <Map
          mapId={MAP_ID}
          defaultCenter={{ lat: centro.latitud, lng: centro.longitud }}
          defaultZoom={17}
          gestureHandling="greedy"
          disableDefaultUI
          clickableIcons={false}
          onCameraChanged={(evento) =>
            onCambio({ latitud: evento.detail.center.lat, longitud: evento.detail.center.lng })
          }
        >
          <Polygon
            paths={contorno}
            strokeColor="#0F766E"
            strokeWeight={2}
            fillColor="#0F766E"
            fillOpacity={0.06}
            clickable={false}
          />
          <Centrar centro={centro} />
        </Map>
        <PinCentral dentro={dentro} />
      </div>
    </APIProvider>
  )
}
