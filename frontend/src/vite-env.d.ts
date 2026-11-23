/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "simulado" en CI y pruebas: mapa sin red. Si no, OpenStreetMap. */
  readonly VITE_MAPA?: 'simulado'
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
