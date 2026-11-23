import { useMutation } from '@tanstack/react-query'
import { useLocation } from 'react-router'
import { Alerta, Pantalla } from '../componentes/ui'
import { cuentas } from '../cuentas/api'

/** Después del registro (CU-01 paso 5): revisar el correo, con opción de reenviar. */
export default function RevisaTuCorreo() {
  const email = (useLocation().state as { email?: string } | null)?.email
  const reenvio = useMutation({ mutationFn: cuentas.reenviarVerificacion })

  return (
    <Pantalla
      titulo="Revisá tu correo"
      bajada={
        email ? (
          <>
            Te mandamos un enlace a <strong className="text-texto">{email}</strong> para confirmar
            tu cuenta. Vence en 24 horas.
          </>
        ) : (
          'Te mandamos un enlace para confirmar tu cuenta. Vence en 24 horas.'
        )
      }
      volverA="/"
    >
      <p className="text-[15px] text-texto-2">
        Si no lo ves en unos minutos, fijate en la carpeta de spam o correo no deseado.
      </p>
      {email && (
        <button
          type="button"
          onClick={() => reenvio.mutate(email)}
          disabled={reenvio.isPending}
          className="h-[52px] rounded-tarjeta border border-primario text-[17px] font-semibold text-primario disabled:opacity-60"
        >
          {reenvio.isPending ? 'Enviando…' : 'Reenviar email'}
        </button>
      )}
      {reenvio.isSuccess && <Alerta tipo="exito">Listo, te mandamos un enlace nuevo.</Alerta>}
      {reenvio.isError && <Alerta tipo="error">{reenvio.error.message}</Alerta>}
    </Pantalla>
  )
}
