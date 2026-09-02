import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import type { RouteRecordRaw } from 'vue-router'
import App from '@/App.vue'
import type { AuthMessage, PasswordResetRequestFormValues } from '@/lib/auth/schema'
import { clearAccessToken, currentUser, isAuthenticated, setAccessToken } from '@/lib/auth/storage'
import { mountWithRouter } from './test-mount'

const authApi = vi.hoisted(() => ({
  resendEmailVerification: vi.fn<(input: PasswordResetRequestFormValues) => Promise<AuthMessage>>(),
}))

vi.mock('@/lib/auth/api', () => authApi)

const routes: RouteRecordRaw[] = [
  { path: '/', component: { template: '<p>Dashboard page</p>' } },
  { path: '/login', component: { template: '<p>Login page</p>' } },
  { path: '/register', component: { template: '<p>Register page</p>' } },
  { path: '/profile', component: { template: '<p>Profile page</p>' } },
  { path: '/verify-email', component: { template: '<p>Verification page</p>' } },
  { path: '/:pathMatch(.*)*', component: { template: '<p>Page</p>' } },
]

const user = {
  id: 'user-1',
  email: 'owner@example.test',
  fullName: 'Local Owner',
  emailVerifiedAt: '2026-08-03T00:00:00.000Z',
  createdAt: '2026-08-03T00:00:00.000Z',
  updatedAt: '2026-08-03T00:00:00.000Z',
}

describe('App', () => {
  afterEach(() => {
    clearAccessToken()
    vi.resetAllMocks()
  })

  it('renders a focused shell for guest routes', async () => {
    const { wrapper } = await mountWithRouter(App, routes, '/login')

    expect(wrapper.text()).toContain('Login page')
    expect(wrapper.find('header').exists()).toBe(false)
    expect(wrapper.find('nav').exists()).toBe(false)
    expect(wrapper.get('main').attributes('id')).toBe('main-content')
    expect(wrapper.get('main').attributes('tabindex')).toBe('-1')
  })

  it('keeps email verification outside the workspace shell for authenticated users', async () => {
    setAccessToken('test-token')
    currentUser.value = user
    const { wrapper } = await mountWithRouter(App, routes, '/verify-email?token=verification-token')

    expect(wrapper.text()).toContain('Verification page')
    expect(wrapper.find('header').exists()).toBe(false)
    expect(wrapper.find('nav').exists()).toBe(false)
  })

  it('keeps password reset outside the workspace shell for authenticated users', async () => {
    setAccessToken('test-token')
    currentUser.value = user
    const { wrapper } = await mountWithRouter(App, routes, '/reset-password?token=reset-token')

    expect(wrapper.text()).toContain('Page')
    expect(wrapper.find('header').exists()).toBe(false)
    expect(wrapper.find('nav').exists()).toBe(false)
  })

  it('renders grouped navigation for authenticated users', async () => {
    setAccessToken('test-token')
    currentUser.value = user
    const { wrapper } = await mountWithRouter(App, routes)

    expect(wrapper.get('nav[aria-label="Primary navigation"]').text()).toContain('Dashboard')
    expect(wrapper.get('nav[aria-label="Primary navigation"]').text()).toContain('Expenses')
    expect(wrapper.get('nav[aria-label="Primary navigation"]').text()).toContain('Expense records')
    expect(wrapper.find('nav[aria-label="Archived records"]').exists()).toBe(false)
    expect(wrapper.find('button[aria-label="Archived records"]').exists()).toBe(false)
    const accountLink = wrapper.get('[data-account-link]')
    const scrollRegion = wrapper.get('[data-sidebar-scroll-region]')
    const workspaceIndex = wrapper.get('[data-workspace-index]')
    expect(accountLink.get('[data-account-initials]').text()).toBe('LO')
    expect(accountLink.get('[data-account-initials]').attributes('aria-hidden')).toBe('true')
    expect(accountLink.text()).toContain(user.fullName)
    expect(accountLink.text()).toContain(user.email)
    expect(scrollRegion.find('[data-account-link]').exists()).toBe(false)
    expect(scrollRegion.classes()).toContain('lg:overflow-y-auto')
    expect(scrollRegion.classes()).toContain('lg:overscroll-contain')
    expect(scrollRegion.classes()).not.toContain('overflow-y-auto')
    expect(scrollRegion.classes()).not.toContain('overscroll-contain')
    expect(workspaceIndex.classes()).toContain('bg-surface-raised')
    expect(workspaceIndex.classes()).not.toContain('bg-brand-strong')
    expect(wrapper.get('[data-mobile-workspace-bar]').classes()).toContain('bg-surface/95')
  })

  it('returns to sign in after an unauthorized API response', async () => {
    setAccessToken('test-token')
    currentUser.value = user
    const { router } = await mountWithRouter(App, routes, '/')

    window.dispatchEvent(new Event('auth:unauthorized'))
    await flushPromises()

    expect(router.currentRoute.value.fullPath).toBe('/login?redirect=/')
  })

  it('reminds users to verify a changed email address', async () => {
    authApi.resendEmailVerification.mockResolvedValue({
      message: 'If an account exists for that email, a verification link has been sent.',
    })
    setAccessToken('test-token')
    currentUser.value = { ...user, emailVerifiedAt: null }
    const { wrapper } = await mountWithRouter(App, routes)

    const reminder = wrapper.get('[data-email-verification-reminder]')
    expect(reminder.text()).toContain('needs verification')
    const resendButton = reminder.get('button')
    expect(resendButton.text()).toBe('Resend email')

    await resendButton.trigger('click')
    await flushPromises()

    expect(authApi.resendEmailVerification).toHaveBeenCalledExactlyOnceWith({
      email: 'owner@example.test',
    })
    expect(resendButton.text()).toBe('Resend email')
    expect(resendButton.attributes('disabled')).toBeUndefined()
    expect(reminder.get('[role="status"]').text()).toBe('Email sent')
  })

  it('uses a single initial for a one-word account name', async () => {
    setAccessToken('test-token')
    currentUser.value = { ...user, fullName: 'Owner' }
    const { wrapper } = await mountWithRouter(App, routes)

    expect(wrapper.get('[data-account-initials]').text()).toBe('O')
  })

  it('keeps frequent destinations in the mobile navigation', async () => {
    setAccessToken('test-token')
    currentUser.value = user
    const { wrapper } = await mountWithRouter(App, routes)
    const mobileNavigation = wrapper.get('nav[aria-label="Mobile navigation"]')

    expect(mobileNavigation.classes()).toContain('grid-cols-5')
    expect(mobileNavigation.get('a[href="/"]').text()).toContain('Dashboard')
    expect(mobileNavigation.get('a[href="/expenses"]').text()).toContain('Expenses')
    expect(mobileNavigation.get('a[href="/recurring-expenses"]').text()).toContain('Recurring')
    expect(mobileNavigation.get('a[href="/reports"]').text()).toContain('Reports')
    expect(mobileNavigation.get('button[aria-label="More navigation"]').text()).toContain('More')
  })

  it('opens secondary navigation in the mobile more sheet', async () => {
    setAccessToken('test-token')
    currentUser.value = user
    const { wrapper } = await mountWithRouter(App, routes)
    const moreButton = wrapper.get('nav[aria-label="Mobile navigation"] button')

    expect(moreButton.attributes('aria-haspopup')).toBe('dialog')
    expect(moreButton.attributes('aria-expanded')).toBe('false')

    await moreButton.trigger('click')

    expect(moreButton.attributes('aria-expanded')).toBe('true')
    expect(wrapper.get('[role="dialog"]').text()).toContain('Organization and account settings.')
    expect(wrapper.get('[role="dialog"]').classes()).toContain('inset-x-3')
    expect(wrapper.get('[role="dialog"]').classes()).toContain('min-w-0')
    expect(wrapper.get('[aria-label="Close more menu"]').attributes('title')).toBe(
      'Close more menu',
    )
    const moreNavigation = wrapper.get('nav[aria-label="More navigation"]')
    expect(moreNavigation.text()).toContain('Vendors')
    expect(moreNavigation.text()).toContain('Categories')
    expect(moreNavigation.classes()).toContain('grid-cols-1')
    expect(moreNavigation.get('a[href="/vendors"] span').classes()).toContain('wrap-break-word')
    expect(wrapper.find('nav[aria-label="Mobile archived records"]').exists()).toBe(false)
    expect(wrapper.get('[data-mobile-account-link]').text()).toContain(user.email)
  })

  it('clears the session and navigates to login on sign out', async () => {
    setAccessToken('test-token')
    currentUser.value = user
    const { router, wrapper } = await mountWithRouter(App, routes)
    const logoutButton = wrapper.findAll('button').find((button) => button.text() === 'Sign out')

    if (!logoutButton) {
      throw new Error('Sign out button not found')
    }

    await logoutButton.trigger('click')
    await flushPromises()

    expect(isAuthenticated.value).toBe(false)
    expect(currentUser.value).toBeNull()
    expect(router.currentRoute.value.path).toBe('/login')
  })

  it('links authenticated users to profile settings', async () => {
    setAccessToken('test-token')
    currentUser.value = user
    const { router, wrapper } = await mountWithRouter(App, routes)

    const profileLink = wrapper.get('[data-account-link]')
    expect(profileLink.attributes('href')).toBe('/profile')
    expect(profileLink.attributes('aria-label')).toBe('Profile settings')
    expect(profileLink.text()).toContain(user.fullName)
    expect(profileLink.text()).toContain(user.email)

    await profileLink.trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/profile')
    expect(wrapper.text()).toContain('Profile page')
  })
})
