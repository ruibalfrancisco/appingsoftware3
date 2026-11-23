import type { RouteObject } from 'react-router'
import Ingreso from './paginas/Ingreso'
import Inicio from './paginas/Inicio'
import Recuperar from './paginas/Recuperar'
import Registro from './paginas/Registro'
import Restablecer from './paginas/Restablecer'
import RevisaTuCorreo from './paginas/RevisaTuCorreo'
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
  { path: '*', element: <Inicio /> },
]
