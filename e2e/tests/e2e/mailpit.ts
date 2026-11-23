import { expect, type APIRequestContext } from '@playwright/test'

const MAILPIT_URL = (process.env.MAILPIT_URL ?? 'http://localhost:8025').replace(/\/$/, '')

interface ResumenDeMensaje {
  ID: string
  Subject: string
}

/**
 * Espera el último email que llegó a `para` con ese asunto y devuelve el enlace que contiene.
 * Mailpit atrapa todos los emails en local y en CI: nada sale a internet.
 */
export async function enlaceDelEmail(
  request: APIRequestContext,
  para: string,
  asunto: RegExp,
  ruta: '/verificar' | '/restablecer',
): Promise<string> {
  let id: string | undefined
  await expect
    .poll(
      async () => {
        const respuesta = await request.get(`${MAILPIT_URL}/api/v1/search`, {
          params: { query: `to:"${para}"` },
        })
        const { messages } = (await respuesta.json()) as { messages: ResumenDeMensaje[] }
        id = messages.find((m) => asunto.test(m.Subject))?.ID
        return id
      },
      { message: `email "${asunto}" para ${para}`, timeout: 15_000 },
    )
    .toBeTruthy()

  const mensaje = await (await request.get(`${MAILPIT_URL}/api/v1/message/${id}`)).json()
  const enlace = (mensaje.Text as string).match(new RegExp(`https?://\\S+${ruta}\\?token=[\\w-]+`))
  expect(enlace, mensaje.Text).toBeTruthy()
  return enlace![0]
}
