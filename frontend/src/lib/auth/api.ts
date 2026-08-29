import { apiConfig } from '../api'
import {
  authMessageSchema,
  authSessionSchema,
  authUserSchema,
  type AuthMessage,
  type AuthSession,
  type AuthUser,
  type PasswordResetConfirmFormValues,
  type LoginFormValues,
  type PasswordResetRequestFormValues,
  type ProfileFormValues,
  type RegisterFormValues,
} from './schema'

export async function register(input: RegisterFormValues) {
  return authUserSchema.parse(
    await apiConfig({
      path: 'auth',
      action: 'register',
      method: 'POST',
      input: {
        email: input.email,
        password: input.password,
        fullName: input.fullName,
      },
    }),
  ) as AuthUser
}

export async function login(input: LoginFormValues) {
  return authSessionSchema.parse(
    await apiConfig({
      path: 'auth',
      action: 'login',
      method: 'POST',
      input,
    }),
  ) as AuthSession
}

export async function requestPasswordReset(input: PasswordResetRequestFormValues) {
  return authMessageSchema.parse(
    await apiConfig({
      path: 'auth/password-reset',
      action: 'request',
      method: 'POST',
      input,
    }),
  ) as AuthMessage
}

export async function confirmPasswordReset(input: PasswordResetConfirmFormValues) {
  return authMessageSchema.parse(
    await apiConfig({
      path: 'auth/password-reset',
      action: 'confirm',
      method: 'POST',
      input: {
        token: input.token,
        password: input.password,
      },
    }),
  ) as AuthMessage
}

export async function fetchCurrentUser() {
  return authUserSchema.parse(
    await apiConfig({
      path: 'auth',
      action: 'me',
      method: 'GET',
    }),
  ) as AuthUser
}

export async function updateProfile(input: ProfileFormValues) {
  return authUserSchema.parse(
    await apiConfig({
      path: 'auth',
      action: 'me',
      method: 'PATCH',
      input,
    }),
  ) as AuthUser
}
