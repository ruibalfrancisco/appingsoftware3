import 'maplibre-gl/dist/maplibre-gl.css'
import { setWorkerUrl } from 'maplibre-gl'
import urlDelWorker from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'

// MapLibre dibuja las calles en un worker. Arma su ruta en tiempo de ejecución, así que Vite no
// lo detecta solo: sin esto, en el build el mapa se ve vacío (solo el fondo, sin calles).
setWorkerUrl(urlDelWorker)

// Mapa vectorial de OpenStreetMap servido por OpenFreeMap: gratis, sin key y sin límites de uso.
export const ESTILO = 'https://tiles.openfreemap.org/styles/liberty'

// Los textos que MapLibre muestra o lee en voz alta (botones, ayudas, nombre del mapa).
export const TEXTOS: Record<string, string> = {
  'AttributionControl.ToggleAttribution': 'Mostrar u ocultar créditos',
  'Map.Title': 'Mapa',
  'Marker.Title': 'Marcador',
  'NavigationControl.ZoomIn': 'Acercar',
  'NavigationControl.ZoomOut': 'Alejar',
  'CooperativeGesturesHandler.WindowsHelpText': 'Usá Ctrl + la rueda del mouse para hacer zoom',
  'CooperativeGesturesHandler.MacHelpText': 'Usá ⌘ + la rueda del mouse para hacer zoom',
  'CooperativeGesturesHandler.MobileHelpText': 'Usá dos dedos para mover el mapa',
}
