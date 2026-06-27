import { apiConfig } from '../api'
import type { AuthUser, LoginFormValues, RegisterFormValues } from './schema'

export async function register(input: RegisterFormValues) {
  return (await apiConfig({
    path: 'auth',
    action: 'register',
    method: 'POST',
    input: {
      email: input.email,
      password: input.password,
      fullName: input.fullName,
    },
  })) as AuthUser
}

export async function login(input: LoginFormValues) {
  return (await apiConfig({
    path: 'auth',
    action: 'login',
    method: 'POST',
    input,
  })) as AuthUser
}
