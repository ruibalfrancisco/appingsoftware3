import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import type { z } from 'zod'
import { Alerta, BotonPrincipal, Campo, Pantalla } from '../componentes/ui'
import { cuentas } from '../cuentas/api'
import { esquemaEmail } from '../cuentas/esquemas'

type Datos = z.output<typeof esquemaEmail>

/** CU-11 Recuperar contraseña: la respuesta es la misma exista o no la cuenta. */
export default function Recuperar() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.input<typeof esquemaEmail>, unknown, Datos>({ resolver: zodResolver(esquemaEmail) })
  const pedido = useMutation({ mutationFn: (datos: Datos) => cuentas.recuperar(datos.email) })

  return (
    <Pantalla
      titulo="Recuperar contraseña"
      bajada="Te mandamos un enlace para elegir una contraseña nueva."
      volverA="/ingresar"
    >
      {pedido.isSuccess ? (
        <Alerta tipo="exito">{pedido.data.mensaje}</Alerta>
      ) : (
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={handleSubmit((datos) => pedido.mutate(datos))}
        >
          <Campo
            etiqueta="Email"
            type="email"
            autoComplete="email"
            error={errors.email?.message}
            {...register('email')}
          />
          {pedido.isError && <Alerta tipo="error">{pedido.error.message}</Alerta>}
          <BotonPrincipal cargando={pedido.isPending}>Enviar enlace</BotonPrincipal>
        </form>
      )}
    </Pantalla>
  )
}
