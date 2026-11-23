import Map, { Marker, NavigationControl } from 'react-map-gl/maplibre'
import { ESTILO, TEXTOS } from './maplibre'
import { nombreDelPin, type PropsMapaDeReclamos, type ReclamoEnElMapa } from './pines'
import PinDeReclamo from './PinDeReclamo'

/** Un reclamo: centrado y cerca. Varios: el encuadre justo para que entren todos. */
function vistaInicial(reclamos: ReclamoEnElMapa[]) {
  if (reclamos.length === 1) {
    const [reclamo] = reclamos
    return { latitude: reclamo.latitud, longitude: reclamo.longitud, zoom: 16 }
  }
  const latitudes = reclamos.map((r) => r.latitud)
  const longitudes = reclamos.map((r) => r.longitud)
  return {
    bounds: [
      [Math.min(...longitudes), Math.min(...latitudes)],
      [Math.max(...longitudes), Math.max(...latitudes)],
    ] as [[number, number], [number, number]],
    // Margen para que ningún pin quede cortado: arriba crecen los pines, abajo están los créditos
    // del mapa y a la derecha los botones de zoom.
    fitBoundsOptions: { padding: { top: 60, bottom: 44, left: 36, right: 64 }, maxZoom: 16 },
  }
}

export default function MapaDeReclamosOSM({ reclamos, onElegir, className }: PropsMapaDeReclamos) {
  const interactivo = onElegir !== undefined
  return (
    <div className={`relative overflow-hidden ${className}`}>
      <Map
        initialViewState={vistaInicial(reclamos)}
        mapStyle={ESTILO}
        locale={TEXTOS}
        style={{ width: '100%', height: '100%' }}
        attributionControl={{ compact: true }}
        interactive={interactivo}
        // Con un dedo se sigue scrolleando la página; el mapa se mueve con dos (como Google Maps).
        cooperativeGestures={interactivo}
        dragRotate={false}
        touchPitch={false}
        pitchWithRotate={false}
      >
        {reclamos.map((reclamo) => (
          <Marker
            key={reclamo.id}
            longitude={reclamo.longitud}
            latitude={reclamo.latitud}
            anchor="bottom"
          >
            {interactivo ? (
              <button
                type="button"
                aria-label={nombreDelPin(reclamo)}
                title={nombreDelPin(reclamo)}
                onClick={() => onElegir(reclamo.id)}
                className="block cursor-pointer transition-transform active:scale-90"
              >
                <PinDeReclamo color={reclamo.tipo.color} icono={reclamo.tipo.icono} />
              </button>
            ) : (
              <PinDeReclamo color={reclamo.tipo.color} icono={reclamo.tipo.icono} />
            )}
          </Marker>
        ))}
        {interactivo && <NavigationControl position="top-right" showCompass={false} />}
      </Map>
    </div>
  )
}
