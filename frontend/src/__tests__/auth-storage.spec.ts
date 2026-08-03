import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('authentication storage', () => {
  beforeEach(() => {
    vi.resetModules()
    localStorage.clear()
  })

  it('hydrates authentication state from the stored access token', async () => {
    localStorage.setItem('virelio.accessToken', 'stored-token')

    const authStorage = await import('@/lib/auth/storage')

    expect(authStorage.getAccessToken()).toBe('stored-token')
    expect(authStorage.isAuthenticated.value).toBe(true)
  })

  describe('after initialization', () => {
    let authStorage: typeof import('@/lib/auth/storage')

    beforeEach(async () => {
      authStorage = await import('@/lib/auth/storage')
    })

    it('stores a token and updates reactive authentication state', () => {
      authStorage.setAccessToken('new-token')

      expect(authStorage.getAccessToken()).toBe('new-token')
      expect(authStorage.isAuthenticated.value).toBe(true)
      expect(localStorage.getItem('virelio.accessToken')).toBe('new-token')
    })

    it('clears the token and hydrated user together', () => {
      authStorage.setAccessToken('test-token')
      authStorage.currentUser.value = {
        id: 'user-1',
        email: 'owner@example.test',
        fullName: 'Local Owner',
        createdAt: '2026-08-03T00:00:00.000Z',
        updatedAt: '2026-08-03T00:00:00.000Z',
      }

      authStorage.clearAccessToken()

      expect(authStorage.getAccessToken()).toBeNull()
      expect(authStorage.currentUser.value).toBeNull()
      expect(authStorage.isAuthenticated.value).toBe(false)
      expect(localStorage.getItem('virelio.accessToken')).toBeNull()
    })
  })
})
