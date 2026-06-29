import { ref } from 'vue'
import type { AuthUser } from './schema'

const ACCESS_TOKEN_KEY = 'virelio.accessToken'

export const currentUser = ref<AuthUser | null>(null)

export function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY)
}

export function setAccessToken(token: string) {
  localStorage.setItem(ACCESS_TOKEN_KEY, token)
}

export function clearAccessToken() {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  currentUser.value = null
}

export function isAuthenticated() {
  return getAccessToken() !== null
}
