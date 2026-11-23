import {
  CircleHelp,
  Construction,
  LightbulbOff,
  Signpost,
  TrafficCone,
  Trash2,
  type LucideIcon,
} from 'lucide-react'

// El backend guarda el nombre del ícono de Lucide en tipo_reclamo.icono.
const ICONOS: Record<string, LucideIcon> = {
  construction: Construction,
  'lightbulb-off': LightbulbOff,
  signpost: Signpost,
  'trash-2': Trash2,
  'traffic-cone': TrafficCone,
  'circle-help': CircleHelp,
}

export default function IconoTipo({ icono, className }: { icono: string; className?: string }) {
  const Icono = ICONOS[icono] ?? CircleHelp
  return <Icono aria-hidden className={className} />
}
