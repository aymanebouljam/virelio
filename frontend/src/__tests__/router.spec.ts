import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthUser } from '@/lib/auth/schema'

const auth = vi.hoisted(() => {
  const currentUser = { value: null as AuthUser | null }
  const isAuthenticated = { value: false }

  return {
    clearAccessToken: vi.fn<() => void>(() => {
      currentUser.value = null
      isAuthenticated.value = false
    }),
    currentUser,
    fetchCurrentUser: vi.fn<() => Promise<AuthUser>>(),
    isAuthenticated,
  }
})

vi.mock('vue-router', async (importOriginal) => {
  const vueRouter = await importOriginal<typeof import('vue-router')>()

  return {
    ...vueRouter,
    createWebHistory: vueRouter.createMemoryHistory,
  }
})

vi.mock('@/lib/auth/storage', () => ({
  clearAccessToken: auth.clearAccessToken,
  currentUser: auth.currentUser,
  getAccessToken: () => null,
  isAuthenticated: auth.isAuthenticated,
}))

vi.mock('@/lib/auth/api', () => ({
  fetchCurrentUser: auth.fetchCurrentUser,
}))

const testUser: AuthUser = {
  id: 'user-1',
  email: 'owner@example.test',
  fullName: 'Local Owner',
  emailVerifiedAt: '2026-08-03T00:00:00.000Z',
  createdAt: '2026-08-03T00:00:00.000Z',
  updatedAt: '2026-08-03T00:00:00.000Z',
}

async function navigate(path: string) {
  const { default: router } = await import('@/router')
  await router.push(path)
  return router
}

describe('authentication route guard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    auth.currentUser.value = null
    auth.isAuthenticated.value = false
  })

  it('redirects unauthenticated users from protected routes', async () => {
    const router = await navigate('/expenses?search=office')

    expect(router.currentRoute.value.name).toBe('login')
    expect(router.currentRoute.value.query).toEqual({
      redirect: '/expenses?search=office',
    })
    expect(auth.fetchCurrentUser).not.toHaveBeenCalled()
  })

  it('allows unauthenticated users to open guest routes', async () => {
    const router = await navigate('/login')

    expect(router.currentRoute.value.name).toBe('login')
    expect(auth.fetchCurrentUser).not.toHaveBeenCalled()
  })

  it('hydrates the current user before opening a protected route', async () => {
    auth.isAuthenticated.value = true
    auth.fetchCurrentUser.mockResolvedValue(testUser)

    const router = await navigate('/vendors')

    expect(router.currentRoute.value.name).toBe('vendors')
    expect(auth.fetchCurrentUser).toHaveBeenCalledOnce()
    expect(auth.currentUser.value).toEqual(testUser)
  })

  it('protects and opens the profile settings route', async () => {
    auth.isAuthenticated.value = true
    auth.fetchCurrentUser.mockResolvedValue(testUser)

    const router = await navigate('/profile')

    expect(router.currentRoute.value.name).toBe('profile')
    expect(auth.fetchCurrentUser).toHaveBeenCalledOnce()
  })

  it('redirects authenticated users away from guest routes', async () => {
    auth.isAuthenticated.value = true
    auth.currentUser.value = testUser

    const router = await navigate('/login')

    expect(router.currentRoute.value.name).toBe('dashboard')
    expect(auth.fetchCurrentUser).not.toHaveBeenCalled()
  })

  it('allows signed-in users to open email verification links', async () => {
    auth.isAuthenticated.value = true
    auth.currentUser.value = testUser

    const router = await navigate('/verify-email?token=verification-token')

    expect(router.currentRoute.value.name).toBe('emailVerification')
    expect(auth.fetchCurrentUser).not.toHaveBeenCalled()
  })

  it('allows signed-in users to open password reset links', async () => {
    auth.isAuthenticated.value = true
    auth.currentUser.value = testUser

    const router = await navigate('/reset-password?token=reset-token')
    expect(router.currentRoute.value.name).toBe('passwordResetConfirm')

    expect(auth.fetchCurrentUser).not.toHaveBeenCalled()
  })

  it('allows signed-in users to open the resend verification page', async () => {
    auth.isAuthenticated.value = true
    auth.currentUser.value = testUser

    const router = await navigate('/resend-verification?email=owner@example.test')

    expect(router.currentRoute.value.name).toBe('resendVerification')
    expect(auth.fetchCurrentUser).not.toHaveBeenCalled()
  })

  it('clears invalid sessions and preserves the intended destination', async () => {
    const { ApiError } = await import('@/lib/api')
    auth.isAuthenticated.value = true
    auth.fetchCurrentUser.mockRejectedValue(new ApiError('Invalid token', null, 401))

    const router = await navigate('/reports')

    expect(auth.clearAccessToken).toHaveBeenCalledOnce()
    expect(router.currentRoute.value.name).toBe('login')
    expect(router.currentRoute.value.query).toEqual({ redirect: '/reports' })
  })

  it('preserves the session when current-user hydration fails temporarily', async () => {
    const { ApiError } = await import('@/lib/api')
    auth.isAuthenticated.value = true
    auth.fetchCurrentUser.mockRejectedValue(new ApiError('Service unavailable', null, 503))

    const router = await navigate('/reports')

    expect(auth.clearAccessToken).not.toHaveBeenCalled()
    expect(auth.isAuthenticated.value).toBe(true)
    expect(router.currentRoute.value.name).toBe('reports')
  })
})
