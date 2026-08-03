import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import type { RouteRecordRaw } from 'vue-router'
import App from '@/App.vue'
import { clearAccessToken, currentUser, isAuthenticated, setAccessToken } from '@/lib/auth/storage'
import { mountWithRouter } from './test-mount'

const routes: RouteRecordRaw[] = [
  { path: '/', component: { template: '<p>Dashboard page</p>' } },
  { path: '/login', component: { template: '<p>Login page</p>' } },
  { path: '/:pathMatch(.*)*', component: { template: '<p>Page</p>' } },
]

describe('App', () => {
  afterEach(() => {
    clearAccessToken()
  })

  it('renders the application shell and active route', async () => {
    const { wrapper } = await mountWithRouter(App, routes)

    expect(wrapper.text()).toContain('Virelio')
    expect(wrapper.text()).toContain('Dashboard')
    expect(wrapper.text()).toContain('Vendors')
    expect(wrapper.text()).toContain('Dashboard page')
  })

  it('clears the session and navigates to login on logout', async () => {
    setAccessToken('test-token')
    currentUser.value = {
      id: 'user-1',
      email: 'owner@example.test',
      fullName: 'Local Owner',
      createdAt: '2026-08-03T00:00:00.000Z',
      updatedAt: '2026-08-03T00:00:00.000Z',
    }
    const { router, wrapper } = await mountWithRouter(App, routes)
    const logoutButton = wrapper.findAll('button').find((button) => button.text() === 'Logout')

    if (!logoutButton) {
      throw new Error('Logout button not found')
    }

    await logoutButton.trigger('click')
    await flushPromises()

    expect(isAuthenticated.value).toBe(false)
    expect(currentUser.value).toBeNull()
    expect(router.currentRoute.value.path).toBe('/login')
  })
})
