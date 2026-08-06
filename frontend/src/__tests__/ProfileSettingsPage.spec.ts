import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { ApiError } from '@/lib/api'
import type { AuthUser, ProfileFormValues } from '@/lib/auth/schema'
import { currentUser } from '@/lib/auth/storage'
import { formatDateTime } from '@/lib/helpers'
import ProfileSettingsPage from '@/pages/ProfileSettingsPage.vue'

const authApi = vi.hoisted(() => ({
  updateProfile: vi.fn<(input: ProfileFormValues) => Promise<AuthUser>>(),
}))

vi.mock('@/lib/auth/api', () => authApi)

const createdAt = '2026-08-05T09:00:00.000Z'
const updatedAt = '2026-08-05T10:00:00.000Z'

const user: AuthUser = {
  id: 'user-1',
  email: 'owner@example.test',
  fullName: 'Local Owner',
  createdAt,
  updatedAt,
}

function getForm(wrapper: VueWrapper) {
  return wrapper.get('form[aria-label="Profile settings form"]')
}

function expectInvalidField(wrapper: VueWrapper, selector: string, errorId: string) {
  expect(wrapper.get(selector).attributes()).toMatchObject({
    'aria-describedby': errorId,
    'aria-invalid': 'true',
  })
  expect(wrapper.get(`#${errorId}`).text()).not.toBe('')
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
    expect(wrapper.get('#profile-full-name').attributes('autocomplete')).toBe('name')
    expect(wrapper.get('#profile-email').attributes('autocomplete')).toBe('email')
    expect(wrapper.get('button[type="submit"]').attributes()).toHaveProperty('disabled')
    expect(wrapper.get(`time[datetime="${createdAt}"]`).text()).toBe(formatDateTime(createdAt))
    expect(wrapper.get(`time[datetime="${updatedAt}"]`).text()).toBe(formatDateTime(updatedAt))
  })

  it('updates the profile and current session user', async () => {
    const nextUpdatedAt = '2026-08-05T11:00:00.000Z'
    const updatedUser: AuthUser = {
      ...user,
      email: 'updated@example.test',
      fullName: 'Updated Owner',
      updatedAt: nextUpdatedAt,
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
    expect(wrapper.get(`time[datetime="${nextUpdatedAt}"]`).text()).toBe(
      formatDateTime(nextUpdatedAt),
    )
    expect(wrapper.get('button[type="submit"]').attributes()).toHaveProperty('disabled')
  })

  it('shows local validation errors', async () => {
    const wrapper = mount(ProfileSettingsPage)

    await wrapper.get('#profile-full-name').setValue('A')
    await wrapper.get('#profile-email').setValue('invalid')
    await getForm(wrapper).trigger('submit')

    expect(wrapper.text()).toContain('Full name is required')
    expect(wrapper.text()).toContain('Email must be a valid email address')
    expectInvalidField(wrapper, '#profile-full-name', 'profile-full-name-error')
    expectInvalidField(wrapper, '#profile-email', 'profile-email-error')
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

    expectInvalidField(wrapper, '#profile-email', 'profile-email-error')
    expect(wrapper.get('#profile-email-error').text()).toBe('Email is already in use')
    expect(currentUser.value).toEqual(user)
  })

  it('announces general update failures', async () => {
    authApi.updateProfile.mockRejectedValue(new ApiError('service unavailable'))
    const wrapper = mount(ProfileSettingsPage)

    await wrapper.get('#profile-full-name').setValue('Updated Owner')
    await getForm(wrapper).trigger('submit')
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toBe('Service unavailable')
  })
})
