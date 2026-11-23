import { z } from 'zod'

// Las mismas reglas que valida el backend (RN-09, CU-01). El backend vuelve a validar todo.

export const dni = z
  .string()
  .transform((valor) => valor.replace(/[.\s]/g, ''))
  .refine((valor) => /^\d{7,8}$/.test(valor), 'El DNI tiene que tener 7 u 8 dígitos')

const texto = (campo: string) =>
  z.string().trim().min(1, `Completá tu ${campo}`).max(80, 'Hasta 80 caracteres')

export const email = z.string().trim().toLowerCase().pipe(z.email('Revisá el email'))

export const password = z
  .string()
  .min(8, 'Al menos 8 caracteres')
  .max(128, 'Hasta 128 caracteres')
  .refine((valor) => valor.trim() !== '', 'La contraseña no puede ser solo espacios')

export const esquemaRegistro = z.object({
  dni,
  nombre: texto('nombre'),
  apellido: texto('apellido'),
  email,
  password,
  acepta_terminos: z.literal(true, 'Tenés que aceptar los términos para seguir'),
})

export const esquemaIngreso = z.object({
  identificador: z.string().trim().min(1, 'Ingresá tu DNI o email'),
  password: z.string().min(1, 'Ingresá tu contraseña'),
})

export const esquemaEmail = z.object({ email })

export const esquemaRestablecer = z
  .object({ password, repetir: z.string() })
  .refine((datos) => datos.password === datos.repetir, {
    message: 'Las contraseñas no coinciden',
    path: ['repetir'],
  })

export type Registro = z.output<typeof esquemaRegistro>
export type Ingreso = z.output<typeof esquemaIngreso>
