// RNF-14: fechas dd/mm/aaaa y hora de 24 h, siempre en la hora de Córdoba.
const ZONA_HORARIA = 'America/Argentina/Cordoba'

const conHora = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23', // 00:12 y no 12:12 a. m.
  timeZone: ZONA_HORARIA,
})

const soloFecha = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: ZONA_HORARIA,
})

export function fechaYHora(iso: string): string {
  return conHora.format(new Date(iso))
}

export function fecha(iso: string): string {
  return soloFecha.format(new Date(iso))
}

/** La dirección si se conoce; si no, las coordenadas del pin. */
export function textoDeUbicacion(reclamo: {
  direccion: string | null
  latitud: number
  longitud: number
}): string {
  return reclamo.direccion ?? `${reclamo.latitud.toFixed(5)}, ${reclamo.longitud.toFixed(5)}`
}
