import { apiConfig } from '../api'
import {
  authSessionSchema,
  authUserSchema,
  type AuthSession,
  type AuthUser,
  type LoginFormValues,
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

export async function fetchCurrentUser() {
  return authUserSchema.parse(
    await apiConfig({
      path: 'auth',
      action: 'me',
      method: 'GET',
    }),
  ) as AuthUser
}
