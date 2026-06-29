import { computed, ref } from 'vue'
import type { AuthUser } from './schema'

const ACCESS_TOKEN_KEY = 'virelio.accessToken'

const accessToken = ref<string | null>(localStorage.getItem(ACCESS_TOKEN_KEY))
export const currentUser = ref<AuthUser | null>(null)
export const isAuthenticated = computed(() => accessToken.value !== null)

export function getAccessToken() {
  return accessToken.value
}

export function setAccessToken(token: string) {
  accessToken.value = token
  localStorage.setItem(ACCESS_TOKEN_KEY, token)
}

export function clearAccessToken() {
  accessToken.value = null
  currentUser.value = null
  localStorage.removeItem(ACCESS_TOKEN_KEY)
}
