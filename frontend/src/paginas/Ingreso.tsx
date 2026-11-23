import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router'
import { ErrorDeApi } from '../api'
import { Alerta, BotonPrincipal, Campo, Pantalla } from '../componentes/ui'
import { CLAVE_SESION, cuentas } from '../cuentas/api'
import { esquemaIngreso, type Ingreso as DatosIngreso } from '../cuentas/esquemas'
import { aplicarErrores } from '../cuentas/formularios'

/** CU-03 Iniciar sesión, con DNI o email. */
export default function Ingreso() {
  const navegar = useNavigate()
  const aviso = (useLocation().state as { aviso?: string } | null)?.aviso
  const clienteQuery = useQueryClient()
  const [errorGeneral, setErrorGeneral] = useState<string>()
  const [sinVerificar, setSinVerificar] = useState(false)
  const {
    register,
    handleSubmit,
    setError,
    getValues,
    formState: { errors },
  } = useForm<DatosIngreso>({ resolver: zodResolver(esquemaIngreso) })

  const ingreso = useMutation({
    mutationFn: cuentas.ingresar,
    onSuccess: (usuario) => {
      clienteQuery.setQueryData(CLAVE_SESION, usuario)
      navegar('/', { replace: true })
    },
    onError: (error) => {
      setSinVerificar(error instanceof ErrorDeApi && error.status === 403)
      setErrorGeneral(aplicarErrores(error, setError, ['identificador', 'password']))
    },
  })
  const reenvio = useMutation({ mutationFn: cuentas.reenviarVerificacion })
  const identificador = getValues('identificador') ?? ''

  return (
    <Pantalla titulo="Ingresar" bajada="Con tu DNI o tu email." volverA="/">
      {aviso && <Alerta tipo="exito">{aviso}</Alerta>}
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={handleSubmit((datos) => {
          setErrorGeneral(undefined)
          ingreso.mutate(datos)
        })}
      >
        <Campo
          etiqueta="DNI o email"
          autoComplete="username"
          error={errors.identificador?.message}
          {...register('identificador')}
        />
        <Campo
          etiqueta="Contraseña"
          type="password"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register('password')}
        />
        <Link to="/recuperar" className="self-end text-[15px] font-semibold text-primario">
          Olvidé mi contraseña
        </Link>
        {errorGeneral && <Alerta tipo="error">{errorGeneral}</Alerta>}
        {sinVerificar && identificador.includes('@') && (
          <button
            type="button"
            onClick={() => reenvio.mutate(identificador)}
            className="text-[15px] font-semibold text-primario"
          >
            {reenvio.isSuccess ? 'Listo, revisá tu correo' : 'Reenviar el email de confirmación'}
          </button>
        )}
        <BotonPrincipal cargando={ingreso.isPending}>Ingresar</BotonPrincipal>
        <p className="text-center text-[15px]">
          ¿No tenés cuenta?{' '}
          <Link to="/registro" className="font-semibold text-primario">
            Creala
          </Link>
        </p>
      </form>
    </Pantalla>
  )
}
