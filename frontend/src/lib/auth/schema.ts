import { z } from 'zod'

const emailSchema = z
  .string()
  .trim()
  .max(254, 'Email must be at most 254 characters')
  .pipe(z.email('Email must be a valid email address'))

const fullNameSchema = z
  .string()
  .trim()
  .min(2, 'Full name is required')
  .max(120, 'Full name must be at most 120 characters')

export const registerFormSchema = z
  .object({
    fullName: fullNameSchema,
    email: emailSchema,
    password: z.string().min(8, 'Password must be at least 8 characters'),
    passwordConfirmation: z.string().min(1, 'Password confirmation is required'),
  })
  .refine((input) => input.password === input.passwordConfirmation, {
    message: 'Passwords do not match',
    path: ['passwordConfirmation'],
  })

export type RegisterFormValues = z.infer<typeof registerFormSchema>

export const loginFormSchema = z.object({
  email: emailSchema,
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

export type LoginFormValues = z.infer<typeof loginFormSchema>

export const profileFormSchema = z.object({
  fullName: fullNameSchema,
  email: emailSchema,
})

export type ProfileFormValues = z.infer<typeof profileFormSchema>

export const authUserSchema = z.object({
  id: z.string().trim().min(1),
  email: emailSchema,
  fullName: fullNameSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
})

export type AuthUser = z.infer<typeof authUserSchema>

export const authSessionSchema = authUserSchema.extend({
  accessToken: z.string().trim().min(1),
})

export type AuthSession = z.infer<typeof authSessionSchema>
