import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router'
import type { z } from 'zod'
import { Alerta, BotonPrincipal, Campo, Pantalla } from '../componentes/ui'
import { CLAVE_SESION, cuentas } from '../cuentas/api'
import { esquemaRestablecer } from '../cuentas/esquemas'

type Datos = z.output<typeof esquemaRestablecer>

/** CU-11: elegir la contraseña nueva desde el enlace del email. Cierra todas las sesiones. */
export default function Restablecer() {
  const token = useSearchParams()[0].get('token')
  const navegar = useNavigate()
  const clienteQuery = useQueryClient()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Datos>({ resolver: zodResolver(esquemaRestablecer) })
  const cambio = useMutation({
    mutationFn: (datos: Datos) => cuentas.restablecer(token ?? '', datos.password),
    onSuccess: (aviso) => {
      clienteQuery.setQueryData(CLAVE_SESION, null)
      navegar('/ingresar', { replace: true, state: { aviso: aviso.mensaje } })
    },
  })

  if (!token) {
    return (
      <Pantalla titulo="Enlace incompleto" volverA="/ingresar">
        <Alerta tipo="error">Abrí el enlace de nuevo desde el email.</Alerta>
      </Pantalla>
    )
  }

  return (
    <Pantalla titulo="Elegí una contraseña nueva" volverA="/ingresar">
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={handleSubmit((datos) => cambio.mutate(datos))}
      >
        <Campo
          etiqueta="Contraseña nueva"
          type="password"
          autoComplete="new-password"
          ayuda="Al menos 8 caracteres"
          error={errors.password?.message}
          {...register('password')}
        />
        <Campo
          etiqueta="Repetila"
          type="password"
          autoComplete="new-password"
          error={errors.repetir?.message}
          {...register('repetir')}
        />
        {cambio.isError && (
          <Alerta tipo="error">
            {cambio.error.message}{' '}
            <Link to="/recuperar" className="underline">
              Pedir otro enlace
            </Link>
          </Alerta>
        )}
        <BotonPrincipal cargando={cambio.isPending}>Guardar contraseña</BotonPrincipal>
      </form>
    </Pantalla>
  )
}
