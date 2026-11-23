import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Alerta, Pantalla } from '../componentes/ui'
import { CLAVE_SESION, cuentas } from '../cuentas/api'

/** CU-02 Verificar email: se abre desde el enlace del correo. */
export default function Verificar() {
  const [parametros] = useSearchParams()
  const token = parametros.get('token')
  const clienteQuery = useQueryClient()
  const verificacion = useMutation({
    mutationFn: cuentas.verificar,
    onSuccess: (usuario) => clienteQuery.setQueryData(CLAVE_SESION, usuario),
  })

  // El enlace es de un solo uso: en modo estricto React monta dos veces, así que se envía una.
  const enviado = useRef(false)
  const { mutate } = verificacion
  useEffect(() => {
    if (token && !enviado.current) {
      enviado.current = true
      mutate(token)
    }
  }, [token, mutate])

  if (!token || verificacion.isError) {
    return (
      <Pantalla titulo="No pudimos confirmar tu email" volverA="/">
        <Alerta tipo="error">
          {verificacion.error?.message ??
            'El enlace está incompleto. Abrilo de nuevo desde el email.'}
        </Alerta>
        <Link to="/ingresar" className="text-center text-[17px] font-semibold text-primario">
          Ir a ingresar y pedir un enlace nuevo
        </Link>
      </Pantalla>
    )
  }

  if (verificacion.isSuccess) {
    return (
      <Pantalla
        titulo={`¡Listo, ${verificacion.data.nombre}!`}
        bajada="Tu email quedó confirmado y ya iniciaste sesión."
      >
        <Link
          to="/"
          className="flex h-[52px] items-center justify-center rounded-tarjeta bg-primario text-[17px] font-semibold text-white"
        >
          Ir al inicio
        </Link>
      </Pantalla>
    )
  }

  return (
    <Pantalla titulo="Confirmando tu email…">
      <p role="status" className="text-[17px] text-texto-2">
        Un momento.
      </p>
    </Pantalla>
  )
}
