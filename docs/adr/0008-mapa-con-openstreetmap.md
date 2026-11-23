# 0008 · Mapa con OpenStreetMap en lugar de Google Maps

- **Estado:** aceptada · 2026-11-23

## Contexto

El documento de requerimientos preveía Google Maps (Maps JavaScript API + Geocoding API) para
el mapa del paso "Ubicación" (RF-08, RF-09) y la dirección del pin (RF-10). Al activar Google
Cloud desde Argentina, la consola exigió un **pago adelantado de USD 30 a 50** para habilitar la
cuenta de facturación, además de la tarjeta. Para un trabajo académico sin presupuesto, eso es un
costo y un riesgo que no se justifican. Usar la key de otra persona tampoco: le factura a ella,
queda expuesta en el navegador y no controlamos sus restricciones.

## Decisión

- **Mapa:** MapLibre GL JS (vía `react-map-gl/maplibre`) con el estilo vectorial *Liberty* de
  **OpenFreeMap**, que sirve teselas de OpenStreetMap gratis, sin key y sin límites declarados.
  Pin fijo en el centro con animación, ejido de Villa Allende resaltado (lo de afuera se
  oscurece), zoom y botón "Usar mi ubicación".
- **Dirección (RF-10):** Nominatim (OpenStreetMap), consultado **desde el backend**
  (`GET /direccion`): respeta su política de uso (1 pedido por segundo, User-Agent propio, caché)
  y la IP del vecino no les llega a terceros. Si falla, el vecino escribe la dirección.
- **Pruebas:** con `VITE_MAPA=simulado` (CI y Vitest) se usa un mapa simulado sin red, y con
  `GEOCODIFICAR=false` el backend no consulta Nominatim: los E2E no dependen de servicios externos.
- El polígono del ejido ya venía de OpenStreetMap (ADR del CU-04): ahora todo el mapa es de la
  misma fuente abierta.

## Alternativas descartadas

- **Google Maps con pago adelantado:** costo y tarjeta para un proyecto sin presupuesto.
- **Key de Google de un tercero:** le factura a otra persona y no controlamos restricciones ni
  vigencia (podría dejar de andar antes del final).
- **Leaflet con teselas raster de OSM:** más liviano, pero se ve menos nítido en celulares y la
  política de tile.openstreetmap.org desaconseja el uso en apps de producción.
- **Mapbox / MapTiler:** buenos, pero piden cuenta y key; con OpenFreeMap no hace falta nada.

## Consecuencias

- Costo cero y sin cuentas: una dependencia externa menos que configurar en cada ambiente.
- MapLibre pesa (~310 KB comprimido): se carga solo en el paso de ubicación (import diferido).
- MapLibre calcula la URL de su worker en tiempo de ejecución; hay que fijarla con
  `setWorkerUrl` o el mapa se ve vacío en el build (detectado en la verificación visual).
- Dependemos de la disponibilidad de OpenFreeMap y Nominatim. Si Nominatim no responde, la app
  sigue funcionando (la dirección se escribe a mano); si OpenFreeMap cayera, se cambia la URL
  del estilo por otro proveedor compatible (MapTiler, Stadia) sin tocar el resto del código.
- Atribución obligatoria de OpenStreetMap, visible en el mapa.
