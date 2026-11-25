import type { RouteObject } from 'react-router'
import DetalleDeGestion from './paginas/DetalleDeGestion'
import DetalleReclamo from './paginas/DetalleReclamo'
import Ingreso from './paginas/Ingreso'
import Inicio from './paginas/Inicio'
import MisReclamos from './paginas/MisReclamos'
import NuevoReclamo from './paginas/NuevoReclamo'
import Recuperar from './paginas/Recuperar'
import Registro from './paginas/Registro'
import Restablecer from './paginas/Restablecer'
import RevisaTuCorreo from './paginas/RevisaTuCorreo'
import Tablero from './paginas/Tablero'
import Verificar from './paginas/Verificar'

// Las rutas /verificar y /restablecer son las que arma el backend en los emails.
export const rutas: RouteObject[] = [
  { path: '/', element: <Inicio /> },
  { path: '/registro', element: <Registro /> },
  { path: '/revisa-tu-correo', element: <RevisaTuCorreo /> },
  { path: '/verificar', element: <Verificar /> },
  { path: '/ingresar', element: <Ingreso /> },
  { path: '/recuperar', element: <Recuperar /> },
  { path: '/restablecer', element: <Restablecer /> },
  { path: '/reclamos/nuevo', element: <NuevoReclamo /> },
  { path: '/mis-reclamos', element: <MisReclamos /> },
  { path: '/reclamos/:id', element: <DetalleReclamo /> },
  // Back office municipal (CU-07 a CU-09): el backend controla el rol en cada pedido.
  { path: '/tablero', element: <Tablero /> },
  { path: '/tablero/reclamos/:id', element: <DetalleDeGestion /> },
  { path: '*', element: <Inicio /> },
]
