import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router'
import type { z } from 'zod'
import { Alerta, BotonPrincipal, Campo, Pantalla } from '../componentes/ui'
import { cuentas } from '../cuentas/api'
import { esquemaRegistro, type Registro as DatosRegistro } from '../cuentas/esquemas'
import { aplicarErrores } from '../cuentas/formularios'

type Entrada = z.input<typeof esquemaRegistro>

/** CU-01 Registrarse. */
export default function Registro() {
  const navegar = useNavigate()
  const [errorGeneral, setErrorGeneral] = useState<string>()
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<Entrada, unknown, DatosRegistro>({ resolver: zodResolver(esquemaRegistro) })

  const registro = useMutation({
    mutationFn: cuentas.registrar,
    onSuccess: (_aviso, datos) => navegar('/revisa-tu-correo', { state: { email: datos.email } }),
    onError: (error) =>
      setErrorGeneral(
        aplicarErrores(error, setError, ['dni', 'nombre', 'apellido', 'email', 'password']),
      ),
  })

  return (
    <Pantalla titulo="Crear cuenta" bajada="Con tu DNI y tu email." volverA="/">
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={handleSubmit((datos) => {
          setErrorGeneral(undefined)
          registro.mutate(datos)
        })}
      >
        <Campo
          etiqueta="DNI"
          inputMode="numeric"
          autoComplete="off"
          ayuda="7 u 8 números, con o sin puntos"
          error={errors.dni?.message}
          {...register('dni')}
        />
        <Campo
          etiqueta="Nombre"
          autoComplete="given-name"
          error={errors.nombre?.message}
          {...register('nombre')}
        />
        <Campo
          etiqueta="Apellido"
          autoComplete="family-name"
          error={errors.apellido?.message}
          {...register('apellido')}
        />
        <Campo
          etiqueta="Email"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />
        <Campo
          etiqueta="Contraseña"
          type="password"
          autoComplete="new-password"
          ayuda="Al menos 8 caracteres"
          error={errors.password?.message}
          {...register('password')}
        />
        <div className="flex flex-col gap-1">
          <label className="flex items-start gap-3 text-[15px]">
            <input
              type="checkbox"
              className="mt-1 size-5 accent-primario"
              aria-invalid={errors.acepta_terminos ? true : undefined}
              aria-describedby={errors.acepta_terminos ? 'acepta_terminos-error' : undefined}
              {...register('acepta_terminos')}
            />
            <span>
              Acepto los términos de uso y la política de privacidad. Mi DNI y mi email no se
              muestran a otros vecinos (Ley 25.326).
            </span>
          </label>
          {errors.acepta_terminos && (
            <p id="acepta_terminos-error" className="text-[13px] font-semibold text-error">
              {errors.acepta_terminos.message}
            </p>
          )}
        </div>
        {errorGeneral && <Alerta tipo="error">{errorGeneral}</Alerta>}
        <BotonPrincipal cargando={registro.isPending}>Crear cuenta</BotonPrincipal>
        <p className="text-center text-[15px]">
          ¿Ya tenés cuenta?{' '}
          <Link to="/ingresar" className="font-semibold text-primario">
            Ingresá
          </Link>
        </p>
      </form>
    </Pantalla>
  )
}
