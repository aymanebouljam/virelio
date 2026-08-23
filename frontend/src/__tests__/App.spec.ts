import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import type { RouteRecordRaw } from 'vue-router'
import App from '@/App.vue'
import { clearAccessToken, currentUser, isAuthenticated, setAccessToken } from '@/lib/auth/storage'
import { mountWithRouter } from './test-mount'

const routes: RouteRecordRaw[] = [
  { path: '/', component: { template: '<p>Dashboard page</p>' } },
  { path: '/login', component: { template: '<p>Login page</p>' } },
  { path: '/register', component: { template: '<p>Register page</p>' } },
  { path: '/profile', component: { template: '<p>Profile page</p>' } },
  { path: '/:pathMatch(.*)*', component: { template: '<p>Page</p>' } },
]

const user = {
  id: 'user-1',
  email: 'owner@example.test',
  fullName: 'Local Owner',
  createdAt: '2026-08-03T00:00:00.000Z',
  updatedAt: '2026-08-03T00:00:00.000Z',
}

describe('App', () => {
  afterEach(() => {
    clearAccessToken()
  })

  it('renders a focused shell for guest routes', async () => {
    const { wrapper } = await mountWithRouter(App, routes, '/login')

    expect(wrapper.text()).toContain('Login page')
    expect(wrapper.find('header').exists()).toBe(false)
    expect(wrapper.find('nav').exists()).toBe(false)
    expect(wrapper.get('main').attributes('id')).toBe('main-content')
    expect(wrapper.get('main').attributes('tabindex')).toBe('-1')
  })

  it('renders grouped navigation for authenticated users', async () => {
    setAccessToken('test-token')
    currentUser.value = user
    const { wrapper } = await mountWithRouter(App, routes)

    expect(wrapper.get('nav[aria-label="Primary navigation"]').text()).toContain('Dashboard')
    expect(wrapper.get('nav[aria-label="Primary navigation"]').text()).toContain('Expenses')
    expect(wrapper.find('nav[aria-label="Archived records"]').exists()).toBe(false)
    expect(wrapper.get('button[aria-label="Archived records"]').attributes('aria-expanded')).toBe(
      'false',
    )
    const accountLink = wrapper.get('[data-account-link]')
    const scrollRegion = wrapper.get('[data-sidebar-scroll-region]')
    expect(accountLink.get('[data-account-initials]').text()).toBe('LO')
    expect(accountLink.get('[data-account-initials]').attributes('aria-hidden')).toBe('true')
    expect(accountLink.text()).toContain(user.fullName)
    expect(accountLink.text()).toContain(user.email)
    expect(scrollRegion.find('[data-account-link]').exists()).toBe(false)
    expect(scrollRegion.classes()).toContain('lg:overflow-y-auto')
    expect(scrollRegion.classes()).toContain('lg:overscroll-contain')
    expect(scrollRegion.classes()).not.toContain('overflow-y-auto')
    expect(scrollRegion.classes()).not.toContain('overscroll-contain')
  })

  it('uses a single initial for a one-word account name', async () => {
    setAccessToken('test-token')
    currentUser.value = { ...user, fullName: 'Owner' }
    const { wrapper } = await mountWithRouter(App, routes)

    expect(wrapper.get('[data-account-initials]').text()).toBe('O')
  })

  it('expands archived navigation on demand', async () => {
    setAccessToken('test-token')
    currentUser.value = user
    const { wrapper } = await mountWithRouter(App, routes)
    const archiveTrigger = wrapper.get('button[aria-label="Archived records"]')

    expect(archiveTrigger.attributes('aria-expanded')).toBe('false')

    await archiveTrigger.trigger('click')

    expect(archiveTrigger.attributes('aria-expanded')).toBe('true')
    const archiveNavigation = wrapper.get('nav[aria-label="Archived records"]')
    expect(archiveNavigation.text()).toContain('Vendors')
    expect(archiveNavigation.text()).toContain('Expenses')
    expect(archiveNavigation.classes()).toContain('pb-2')
  })

  it('keeps frequent destinations in the mobile navigation', async () => {
    setAccessToken('test-token')
    currentUser.value = user
    const { wrapper } = await mountWithRouter(App, routes)
    const mobileNavigation = wrapper.get('nav[aria-label="Mobile navigation"]')

    expect(mobileNavigation.get('a[href="/"]').text()).toContain('Dashboard')
    expect(mobileNavigation.get('a[href="/expenses"]').text()).toContain('Expenses')
    expect(mobileNavigation.get('a[href="/recurring-expenses"]').text()).toContain('Recurring')
    expect(mobileNavigation.get('a[href="/reports"]').text()).toContain('Reports')
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
    expect(wrapper.get('[role="dialog"]').text()).toContain(
      'Organization, archives, and account settings.',
    )
    expect(wrapper.get('nav[aria-label="More navigation"]').text()).toContain('Vendors')
    expect(wrapper.get('nav[aria-label="More navigation"]').text()).toContain('Categories')
    expect(wrapper.get('nav[aria-label="Mobile archived records"]').text()).toContain(
      'Recurring expenses',
    )
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
