import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { ApiError } from '@/lib/api'
import type {
  AuthAccessToken,
  AuthMessage,
  AuthUser,
  ChangePasswordFormValues,
  PasswordResetRequestFormValues,
  ProfileFormValues,
} from '@/lib/auth/schema'
import { clearAccessToken, currentUser, getAccessToken } from '@/lib/auth/storage'
import { formatDateTime } from '@/lib/helpers'
import ProfileSettingsPage from '@/pages/ProfileSettingsPage.vue'

const authApi = vi.hoisted(() => ({
  changePassword: vi.fn<(input: ChangePasswordFormValues) => Promise<AuthAccessToken>>(),
  requestPasswordReset: vi.fn<(input: PasswordResetRequestFormValues) => Promise<AuthMessage>>(),
  updateProfile: vi.fn<(input: ProfileFormValues) => Promise<AuthUser>>(),
}))

vi.mock('@/lib/auth/api', () => authApi)

const createdAt = '2026-08-05T09:00:00.000Z'
const updatedAt = '2026-08-05T10:00:00.000Z'

const user: AuthUser = {
  id: 'user-1',
  email: 'owner@example.test',
  fullName: 'Local Owner',
  emailVerifiedAt: createdAt,
  createdAt,
  updatedAt,
}

function getForm(wrapper: VueWrapper) {
  return wrapper.get('form[aria-label="Profile settings form"]')
}

function getPasswordForm(wrapper: VueWrapper) {
  return wrapper.get('form[aria-label="Password settings form"]')
}

async function openPasswordForm(wrapper: VueWrapper) {
  await wrapper.get('[data-change-password]').trigger('click')
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
  vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-09-05T10:00:00.000Z').getTime())
  currentUser.value = user
})

afterEach(() => {
  vi.restoreAllMocks()
  clearAccessToken()
})

describe('profile settings workflow', () => {
  it('loads the current profile and disables unchanged submissions', () => {
    const wrapper = mount(ProfileSettingsPage)

    expect(wrapper.get('h1').text()).toBe('Profile settings')
    expect(wrapper.findAll('[data-profile-record]')).toHaveLength(1)
    expect(wrapper.get('#profile-full-name').element).toHaveProperty('value', 'Local Owner')
    expect(wrapper.get('#profile-email').element).toHaveProperty('value', 'owner@example.test')
    expect(wrapper.get('#profile-full-name').attributes('autocomplete')).toBe('name')
    expect(wrapper.get('#profile-email').attributes('autocomplete')).toBe('email')
    expect(wrapper.get('#profile-full-name').attributes('name')).toBe('fullName')
    expect(wrapper.get('#profile-email').attributes('name')).toBe('email')
    expect(wrapper.get('button[type="submit"]').attributes()).toHaveProperty('disabled')
    expect(wrapper.find('form[aria-label="Password settings form"]').exists()).toBe(false)
    expect(wrapper.get('[data-change-password]').text()).toBe('Change password')
    expect(wrapper.get('[data-profile-initials]').text()).toBe('LO')
    expect(wrapper.get('[data-profile-initials]').attributes('aria-hidden')).toBe('true')
    expect(wrapper.get(`time[datetime="${createdAt}"]`).text()).toBe('1 month ago')
    expect(wrapper.get(`time[datetime="${createdAt}"]`).attributes('title')).toBe(
      formatDateTime(createdAt),
    )
    expect(wrapper.get(`time[datetime="${updatedAt}"]`).text()).toBe('1 month ago')
    expect(wrapper.get(`time[datetime="${updatedAt}"]`).attributes('title')).toBe(
      formatDateTime(updatedAt),
    )
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
    expect(wrapper.get('[data-profile-initials]').text()).toBe('UO')
    expect(wrapper.get(`time[datetime="${nextUpdatedAt}"]`).text()).toBe('1 month ago')
    expect(wrapper.get(`time[datetime="${nextUpdatedAt}"]`).attributes('title')).toBe(
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

  it('changes the password and replaces the current access token', async () => {
    authApi.changePassword.mockResolvedValue({ accessToken: 'refreshed-token' })
    const wrapper = mount(ProfileSettingsPage)

    await openPasswordForm(wrapper)
    await wrapper.get('#current-password').setValue('current-password')
    await wrapper.get('#new-password').setValue('new-password')
    await wrapper.get('#new-password-confirmation').setValue('new-password')
    await getPasswordForm(wrapper).trigger('submit')
    await flushPromises()

    expect(authApi.changePassword).toHaveBeenCalledExactlyOnceWith({
      currentPassword: 'current-password',
      password: 'new-password',
      passwordConfirmation: 'new-password',
    })
    expect(getAccessToken()).toBe('refreshed-token')
    expect(wrapper.get('[role="status"]').text()).toBe('Password updated')
    expect((wrapper.get('#current-password').element as HTMLInputElement).value).toBe('')
  })

  it('reveals and hides each password field independently', async () => {
    const wrapper = mount(ProfileSettingsPage)

    await openPasswordForm(wrapper)
    expect(wrapper.get('#current-password').attributes('type')).toBe('password')
    expect(wrapper.get('#new-password').attributes('type')).toBe('password')

    await wrapper.get('[data-toggle-current-password]').trigger('click')
    expect(wrapper.get('#current-password').attributes('type')).toBe('text')
    expect(wrapper.get('#new-password').attributes('type')).toBe('password')

    await wrapper.get('[data-toggle-new-password]').trigger('click')
    expect(wrapper.get('#new-password').attributes('type')).toBe('text')

    await wrapper.get('[data-toggle-password-confirmation]').trigger('click')
    expect(wrapper.get('#new-password-confirmation').attributes('type')).toBe('text')
  })

  it('requests a password reset email for the current user', async () => {
    authApi.requestPasswordReset.mockResolvedValue({
      message: 'If an account exists for that email, a password reset link has been sent.',
    })
    const wrapper = mount(ProfileSettingsPage)

    await openPasswordForm(wrapper)
    await wrapper.get('[data-password-reset]').trigger('click')
    await flushPromises()

    expect(authApi.requestPasswordReset).toHaveBeenCalledExactlyOnceWith({
      email: 'owner@example.test',
    })
    expect(wrapper.get('[role="status"]').text()).toContain('password reset link has been sent')
  })

  it('shows password validation errors before submitting', async () => {
    const wrapper = mount(ProfileSettingsPage)

    await openPasswordForm(wrapper)
    expect(getPasswordForm(wrapper).get('button[type="submit"]').attributes()).toHaveProperty(
      'disabled',
    )
    await wrapper.get('#current-password').setValue('short')
    await wrapper.get('#new-password').setValue('new-password')
    await wrapper.get('#new-password-confirmation').setValue('different-password')
    await getPasswordForm(wrapper).trigger('submit')

    expect(wrapper.get('#current-password-error').text()).toContain(
      'Current password must be at least 8 characters',
    )
    expect(wrapper.get('#new-password-confirmation-error').text()).toContain(
      'Passwords do not match',
    )
    expect(authApi.changePassword).not.toHaveBeenCalled()
  })

  it('shows current password validation error', async () => {
    authApi.changePassword.mockRejectedValue(
      new ApiError('Validation failed', {
        currentPassword: 'Current password is incorrect',
      }),
    )
    const wrapper = mount(ProfileSettingsPage)

    await openPasswordForm(wrapper)
    expect(getPasswordForm(wrapper).get('button[type="submit"]').attributes()).toHaveProperty(
      'disabled',
    )
    await wrapper.get('#current-password').setValue('incorrect-current-password')
    await wrapper.get('#new-password').setValue('new-password')
    await wrapper.get('#new-password-confirmation').setValue('new-password')
    await getPasswordForm(wrapper).trigger('submit')

    expect(wrapper.get('#current-password-error').text()).toContain('Current password is incorrect')
    expect(authApi.changePassword).toHaveBeenCalledWith({
      currentPassword: 'incorrect-current-password',
      password: 'new-password',
      passwordConfirmation: 'new-password',
    })
  })
})
