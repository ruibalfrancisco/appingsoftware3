import { colorDelTipo, nombreDelPin, type PropsMapaDeReclamos, type ReclamoEnElMapa } from './pines'
import PinDeReclamo from './PinDeReclamo'

/** Posición de 10 % a 90 % dentro de la caja que contiene a todos los reclamos. */
function posicion(reclamo: ReclamoEnElMapa, todos: ReclamoEnElMapa[]) {
  const proporcion = (valor: number, valores: number[]) => {
    const min = Math.min(...valores)
    const max = Math.max(...valores)
    return max === min ? 0.5 : (valor - min) / (max - min)
  }
  const x = proporcion(
    reclamo.longitud,
    todos.map((r) => r.longitud),
  )
  const y =
    1 -
    proporcion(
      reclamo.latitud,
      todos.map((r) => r.latitud),
    ) // el norte, arriba
  return { left: `${10 + x * 80}%`, top: `${10 + y * 80}%` }
}

/**
 * Reemplazo del mapa de reclamos en CI y en las pruebas (VITE_MAPA=simulado): mismos pines y
 * colores, sin red. No agrupa: eso lo hace MapLibre en el mapa real.
 */
export default function MapaDeReclamosSimulado({
  reclamos,
  onElegir,
  className,
  colorDe = colorDelTipo,
  seleccionado,
}: PropsMapaDeReclamos) {
  const unico = reclamos.length === 1 ? reclamos[0] : undefined
  return (
    <div
      role={onElegir ? undefined : 'img'}
      aria-label={onElegir ? undefined : 'Mapa con la ubicación del reclamo'}
      className={`relative overflow-hidden bg-[linear-gradient(#e2e8f0_1px,transparent_1px),linear-gradient(90deg,#e2e8f0_1px,transparent_1px)] bg-[size:32px_32px] ${className}`}
    >
      {reclamos.map((reclamo) => (
        <div
          key={reclamo.id}
          className="absolute -translate-x-1/2 -translate-y-full"
          style={posicion(reclamo, reclamos)}
        >
          {onElegir ? (
            <button
              type="button"
              aria-label={nombreDelPin(reclamo)}
              aria-pressed={seleccionado === undefined ? undefined : reclamo.id === seleccionado}
              onClick={() => onElegir(reclamo.id)}
              className="block"
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
        </div>
      ))}
      <p className="absolute bottom-2 left-2 rounded bg-white/90 px-2 py-1 text-[13px] text-texto-2">
        Mapa simulado
        {unico && ` · ${unico.latitud.toFixed(5)}, ${unico.longitud.toFixed(5)}`}
      </p>
    </div>
  )
}
