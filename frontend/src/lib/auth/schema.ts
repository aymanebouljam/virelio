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

export const passwordResetRequestFormSchema = z.object({
  email: emailSchema,
})

export type PasswordResetRequestFormValues = z.infer<typeof passwordResetRequestFormSchema>

export const passwordResetConfirmFormSchema = z
  .object({
    token: z.string().trim().min(1, 'Reset token is required'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    passwordConfirmation: z.string().min(1, 'Password confirmation is required'),
  })
  .refine((input) => input.password === input.passwordConfirmation, {
    message: 'Passwords do not match',
    path: ['passwordConfirmation'],
  })

export type PasswordResetConfirmFormValues = z.infer<typeof passwordResetConfirmFormSchema>

export const changePasswordFormSchema = z
  .object({
    currentPassword: z.string().min(8, 'Current password must be at least 8 characters'),
    password: z.string().min(8, 'New password must be at least 8 characters'),
    passwordConfirmation: z.string().min(1, 'Password confirmation is required'),
  })
  .refine((input) => input.password === input.passwordConfirmation, {
    message: 'Passwords do not match',
    path: ['passwordConfirmation'],
  })

export type ChangePasswordFormValues = z.infer<typeof changePasswordFormSchema>

export const emailVerificationConfirmFormSchema = z.object({
  token: z.string().trim().min(1, 'Verification token is required'),
})

export type EmailVerificationConfirmFormValues = z.infer<typeof emailVerificationConfirmFormSchema>

export const authMessageSchema = z.object({
  message: z.string().trim().min(1),
})

export type AuthMessage = z.infer<typeof authMessageSchema>

export const authAccessTokenSchema = z.object({
  accessToken: z.string().trim().min(1),
})

export type AuthAccessToken = z.infer<typeof authAccessTokenSchema>

export const profileFormSchema = z.object({
  fullName: fullNameSchema,
  email: emailSchema,
})

export type ProfileFormValues = z.infer<typeof profileFormSchema>

export const authUserSchema = z.object({
  id: z.string().trim().min(1),
  email: emailSchema,
  fullName: fullNameSchema,
  emailVerifiedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
})

export type AuthUser = z.infer<typeof authUserSchema>

export const authSessionSchema = authUserSchema.extend({
  accessToken: z.string().trim().min(1),
})

export type AuthSession = z.infer<typeof authSessionSchema>
