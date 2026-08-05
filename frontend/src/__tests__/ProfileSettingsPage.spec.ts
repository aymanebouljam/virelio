import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { ApiError } from '@/lib/api'
import type { AuthUser, ProfileFormValues } from '@/lib/auth/schema'
import { currentUser } from '@/lib/auth/storage'
import ProfileSettingsPage from '@/pages/ProfileSettingsPage.vue'

const authApi = vi.hoisted(() => ({
  updateProfile: vi.fn<(input: ProfileFormValues) => Promise<AuthUser>>(),
}))

vi.mock('@/lib/auth/api', () => authApi)

const user: AuthUser = {
  id: 'user-1',
  email: 'owner@example.test',
  fullName: 'Local Owner',
  createdAt: '2026-08-05T09:00:00.000Z',
  updatedAt: '2026-08-05T09:00:00.000Z',
}

function getForm(wrapper: VueWrapper) {
  return wrapper.get('form[aria-label="Profile settings form"]')
}

beforeEach(() => {
  vi.resetAllMocks()
  currentUser.value = user
})

afterEach(() => {
  currentUser.value = null
})

describe('profile settings workflow', () => {
  it('loads the current profile and disables unchanged submissions', () => {
    const wrapper = mount(ProfileSettingsPage)

    expect(wrapper.get('#profile-full-name').element).toHaveProperty('value', 'Local Owner')
    expect(wrapper.get('#profile-email').element).toHaveProperty('value', 'owner@example.test')
    expect(wrapper.get('button[type="submit"]').attributes()).toHaveProperty('disabled')
  })

  it('updates the profile and current session user', async () => {
    const updatedUser: AuthUser = {
      ...user,
      email: 'updated@example.test',
      fullName: 'Updated Owner',
      updatedAt: '2026-08-05T10:00:00.000Z',
    }
    authApi.updateProfile.mockResolvedValue(updatedUser)
    const wrapper = mount(ProfileSettingsPage)

    await wrapper.get('#profile-full-name').setValue('  Updated Owner  ')
    await wrapper.get('#profile-email').setValue('  updated@example.test  ')
    await getForm(wrapper).trigger('submit')
    await flushPromises()

    expect(authApi.updateProfile).toHaveBeenCalledExactlyOnceWith({
      fullName: 'Updated Owner',
      email: 'updated@example.test',
    })
    expect(currentUser.value).toEqual(updatedUser)
    expect(wrapper.get('[role="status"]').text()).toBe('Profile updated')
    expect(wrapper.get('button[type="submit"]').attributes()).toHaveProperty('disabled')
  })

  it('shows local validation errors', async () => {
    const wrapper = mount(ProfileSettingsPage)

    await wrapper.get('#profile-full-name').setValue('A')
    await wrapper.get('#profile-email').setValue('invalid')
    await getForm(wrapper).trigger('submit')

    expect(wrapper.text()).toContain('Full name is required')
    expect(wrapper.text()).toContain('Email must be a valid email address')
    expect(authApi.updateProfile).not.toHaveBeenCalled()
  })

  it('shows API field errors', async () => {
    authApi.updateProfile.mockRejectedValue(
      new ApiError('validation failed', { email: 'Email is already in use' }),
    )
    const wrapper = mount(ProfileSettingsPage)

    await wrapper.get('#profile-email').setValue('taken@example.test')
    await getForm(wrapper).trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('Email is already in use')
    expect(currentUser.value).toEqual(user)
  })
})
