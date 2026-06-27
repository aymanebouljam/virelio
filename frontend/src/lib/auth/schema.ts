import { z } from 'zod'

export const registerFormSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Full name is required'),
    email: z
      .string()
      .trim()
      .max(120, 'Email must be at most 120 characters')
      .pipe(z.email('Email must be a valid email address')),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    passwordConfirmation: z.string().min(1, 'Password confirmation is required'),
  })
  .refine((input) => input.password === input.passwordConfirmation, {
    message: 'Passwords do not match',
    path: ['passwordConfirmation'],
  })

export type RegisterFormValues = z.infer<typeof registerFormSchema>

export const loginFormSchema = z.object({
  email: z
    .string()
    .trim()
    .max(120, 'Email must be at most 120 characters')
    .pipe(z.email('Email must be a valid email address')),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

export type LoginFormValues = z.infer<typeof loginFormSchema>

export const authUserSchema = z.object({
  id: z.string().trim().min(1),
  email: z
    .string()
    .trim()
    .max(120, 'Email must be at most 120 characters')
    .pipe(z.email('Email must be a valid email address')),
  fullName: z.string().trim().min(1),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
})

export type AuthUser = z.infer<typeof authUserSchema>
