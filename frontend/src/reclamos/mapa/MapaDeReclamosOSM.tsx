import { useEffect, useMemo, useRef, useState } from 'react'
import MapaBase, { Marker, NavigationControl, type MapRef } from 'react-map-gl/maplibre'
import Supercluster from 'supercluster'
import { ESTILO, TEXTOS } from './maplibre'
import { colorDelTipo, nombreDelPin, type PropsMapaDeReclamos, type ReclamoEnElMapa } from './pines'
import PinDeReclamo from './PinDeReclamo'

type Limites = [[number, number], [number, number]]

function limitesDe(reclamos: ReclamoEnElMapa[]): Limites {
  const latitudes = reclamos.map((r) => r.latitud)
  const longitudes = reclamos.map((r) => r.longitud)
  return [
    [Math.min(...longitudes), Math.min(...latitudes)],
    [Math.max(...longitudes), Math.max(...latitudes)],
  ]
}

// Margen para que ningún pin quede cortado: arriba crecen los pines, abajo están los créditos
// del mapa y a la derecha los botones de zoom.
const MARGEN = { top: 60, bottom: 44, left: 36, right: 64 }

/** Un reclamo: centrado y cerca. Varios: el encuadre justo para que entren todos. */
function vistaInicial(reclamos: ReclamoEnElMapa[]) {
  if (reclamos.length === 1) {
    const [reclamo] = reclamos
    return { latitude: reclamo.latitud, longitude: reclamo.longitud, zoom: 16 }
  }
  return { bounds: limitesDe(reclamos), fitBoundsOptions: { padding: MARGEN, maxZoom: 16 } }
}

interface Vista {
  limites: [number, number, number, number]
  zoom: number
}

export default function MapaDeReclamosOSM({
  reclamos,
  onElegir,
  className,
  colorDe = colorDelTipo,
  agrupar = false,
  seleccionado,
}: PropsMapaDeReclamos) {
  const interactivo = onElegir !== undefined
  const mapa = useRef<MapRef>(null)
  const [vista, setVista] = useState<Vista>()

  // RF-26: los pines que se superponen se agrupan en un círculo con la cantidad.
  const indice = useMemo(() => {
    if (!agrupar) return undefined
    const grupos = new Supercluster<{ id: number }>({ radius: 56, maxZoom: 18 })
    grupos.load(
      reclamos.map((r) => ({
        type: 'Feature' as const,
        properties: { id: r.id },
        geometry: { type: 'Point' as const, coordinates: [r.longitud, r.latitud] },
      })),
    )
    return grupos
  }, [reclamos, agrupar])
  const porId = useMemo(() => Object.fromEntries(reclamos.map((r) => [r.id, r])), [reclamos])

  const encuadrar = (duracion: number) => {
    const actual = mapa.current
    if (!actual || reclamos.length === 0) return
    if (reclamos.length === 1) {
      const [reclamo] = reclamos
      actual.jumpTo({ center: [reclamo.longitud, reclamo.latitud], zoom: 16 })
    } else {
      actual.fitBounds(limitesDe(reclamos), { padding: MARGEN, maxZoom: 16, duration: duracion })
    }
  }

  // Si cambian los reclamos (filtros del Tablero), el mapa se encuadra de nuevo.
  const ids = reclamos.map((r) => r.id).join(',')
  const primeraVez = useRef(true)
  useEffect(() => {
    if (primeraVez.current) {
      primeraVez.current = false
      return
    }
    encuadrar(500)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo cuando cambia el conjunto
  }, [ids])

  const actualizarVista = () => {
    const actual = mapa.current
    if (!actual) return
    const b = actual.getBounds()
    setVista({
      limites: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()],
      zoom: Math.floor(actual.getZoom()),
    })
  }

  const pin = (reclamo: ReclamoEnElMapa) => (
    <Marker
      key={reclamo.id}
      longitude={reclamo.longitud}
      latitude={reclamo.latitud}
      anchor="bottom"
      style={{ zIndex: reclamo.id === seleccionado ? 1 : 0 }}
    >
      {interactivo ? (
        <button
          type="button"
          aria-label={nombreDelPin(reclamo)}
          aria-pressed={seleccionado === undefined ? undefined : reclamo.id === seleccionado}
          title={nombreDelPin(reclamo)}
          onClick={() => onElegir(reclamo.id)}
          className="block cursor-pointer transition-transform active:scale-90"
        >
          <PinDeReclamo
            color={colorDe(reclamo)}
            icono={reclamo.tipo.icono}
            destacado={reclamo.id === seleccionado}
          />
        </button>
      ) : (
        <PinDeReclamo color={colorDe(reclamo)} icono={reclamo.tipo.icono} />
      )}
    </Marker>
  )

  const elementos = indice && vista ? indice.getClusters(vista.limites, vista.zoom) : undefined

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <MapaBase
        ref={mapa}
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
        onLoad={actualizarVista}
        onMoveEnd={actualizarVista}
      >
        {elementos
          ? elementos.map((elemento) => {
              const [longitud, latitud] = elemento.geometry.coordinates
              if ('cluster' in elemento.properties && elemento.properties.cluster) {
                const { cluster_id: id, point_count: cantidad } = elemento.properties
                return (
                  <Marker key={`grupo-${id}`} longitude={longitud} latitude={latitud}>
                    <button
                      type="button"
                      aria-label={`${cantidad} reclamos juntos: acercar`}
                      onClick={() =>
                        mapa.current?.easeTo({
                          center: [longitud, latitud],
                          zoom: Math.min(indice!.getClusterExpansionZoom(id), 18),
                          duration: 400,
                        })
                      }
                      className="grid size-11 cursor-pointer place-items-center rounded-full bg-primario text-[15px] font-bold text-white shadow-md ring-4 ring-white/80 transition-transform active:scale-90"
                    >
                      {cantidad}
                    </button>
                  </Marker>
                )
              }
              const reclamo = porId[(elemento.properties as { id: number }).id]
              return reclamo ? pin(reclamo) : null
            })
          : reclamos.map(pin)}
        {interactivo && <NavigationControl position="top-right" showCompass={false} />}
      </MapaBase>
    </div>
  )
}
