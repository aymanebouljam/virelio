import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, type VueWrapper } from '@vue/test-utils'
import type { Component } from 'vue'
import type { RouteRecordRaw } from 'vue-router'
import { ApiError } from '@/lib/api'
import type {
  AuthMessage,
  AuthSession,
  AuthUser,
  EmailVerificationConfirmFormValues,
  LoginFormValues,
  PasswordResetConfirmFormValues,
  PasswordResetRequestFormValues,
  RegisterFormValues,
} from '@/lib/auth/schema'
import { clearAccessToken, getAccessToken, isAuthenticated } from '@/lib/auth/storage'
import LoginPage from '@/pages/LoginPage.vue'
import EmailVerificationPage from '@/pages/EmailVerificationPage.vue'
import PasswordResetConfirmPage from '@/pages/PasswordResetConfirmPage.vue'
import RegisterPage from '@/pages/RegisterPage.vue'
import ResendVerificationPage from '@/pages/ResendVerificationPage.vue'
import { mountWithRouter } from './test-mount'

const authApi = vi.hoisted(() => ({
  confirmEmailVerification:
    vi.fn<(input: EmailVerificationConfirmFormValues) => Promise<AuthMessage>>(),
  confirmPasswordReset: vi.fn<(input: PasswordResetConfirmFormValues) => Promise<AuthMessage>>(),
  login: vi.fn<(input: LoginFormValues) => Promise<AuthSession>>(),
  register: vi.fn<(input: RegisterFormValues) => Promise<AuthUser>>(),
  resendEmailVerification: vi.fn<(input: PasswordResetRequestFormValues) => Promise<AuthMessage>>(),
}))

vi.mock('@/lib/auth/api', () => authApi)

const routes: RouteRecordRaw[] = [
  { path: '/', name: 'dashboard', component: { template: '<p>Dashboard</p>' } },
  { path: '/expenses', name: 'expenses', component: { template: '<p>Expenses</p>' } },
  { path: '/login', name: 'login', component: LoginPage },
  { path: '/verify-email', name: 'emailVerification', component: EmailVerificationPage },
  { path: '/reset-password', name: 'passwordResetConfirm', component: PasswordResetConfirmPage },
  { path: '/register', name: 'register', component: RegisterPage },
  { path: '/resend-verification', name: 'resendVerification', component: ResendVerificationPage },
]

const user: AuthUser = {
  id: 'user-1',
  email: 'owner@example.test',
  fullName: 'Local Owner',
  createdAt: '2026-08-05T09:00:00.000Z',
  updatedAt: '2026-08-05T09:00:00.000Z',
}

const session: AuthSession = {
  ...user,
  accessToken: 'test-token',
}

function getForm(wrapper: VueWrapper, label: string) {
  return wrapper.get(`form[aria-label="${label}"]`)
}

function expectInvalidField(wrapper: VueWrapper, selector: string, errorId: string) {
  expect(wrapper.get(selector).attributes()).toMatchObject({
    'aria-describedby': errorId,
    'aria-invalid': 'true',
  })
  expect(wrapper.get(`#${errorId}`).text()).not.toBe('')
}

async function mountPage(component: Component, initialRoute: string) {
  const result = await mountWithRouter(component, routes, initialRoute)
  await flushPromises()
  return result
}

async function fillLoginForm(wrapper: VueWrapper) {
  await wrapper.get('#login-email').setValue('owner@example.test')
  await wrapper.get('#login-password').setValue('test-password')
}

async function fillRegistrationForm(wrapper: VueWrapper) {
  await wrapper.get('#register-full-name').setValue('Local Owner')
  await wrapper.get('#register-email').setValue('owner@example.test')
  await wrapper.get('#register-password').setValue('test-password')
  await wrapper.get('#register-password-confirmation').setValue('test-password')
}

async function fillPasswordResetConfirmationForm(wrapper: VueWrapper) {
  await wrapper.get('#password-reset-password').setValue('new-password')
  await wrapper.get('#password-reset-password-confirmation').setValue('new-password')
}

beforeEach(() => {
  vi.resetAllMocks()
  clearAccessToken()
})

afterEach(() => {
  clearAccessToken()
})

describe('login workflow', () => {
  it('presents account context and sign-in affordances', async () => {
    const { wrapper } = await mountPage(LoginPage, '/login')

    const accountContext = wrapper.get('[aria-label="Account benefits"]')

    expect(wrapper.get('h1').text()).toBe('Keep every expense in context.')
    expect(wrapper.get('h2').text()).toBe('Sign in to Virelio')
    expect(accountContext.text()).toContain('Proof stays attached to each expense')
    expect(accountContext.findAll('li')).toHaveLength(3)
    expect(wrapper.get('[aria-label="Virelio brand"]').text()).toContain('Virelio')
    expect(accountContext.classes()).toEqual(expect.arrayContaining(['hidden', 'lg:flex']))
    expect(accountContext.classes()).toContain('bg-surface-raised')
    expect(accountContext.classes()).not.toContain('bg-brand-strong')
    expect(wrapper.get('[data-auth-compact-brand]').classes()).toContain('lg:hidden')
    expect(wrapper.get('#login-email').attributes('autocomplete')).toBe('email')
    expect(wrapper.get('#login-password').attributes('autocomplete')).toBe('current-password')
    expect(wrapper.get('[aria-label="Show password"]').attributes('aria-label')).toBe(
      'Show password',
    )
  })

  it('reveals and hides the login password', async () => {
    const { wrapper } = await mountPage(LoginPage, '/login')

    expect(wrapper.get('#login-password').attributes('type')).toBe('password')
    await wrapper.get('[aria-label="Show password"]').trigger('click')
    expect(wrapper.get('#login-password').attributes('type')).toBe('text')
    await wrapper.get('[aria-label="Hide password"]').trigger('click')
    expect(wrapper.get('#login-password').attributes('type')).toBe('password')
  })

  it('stores the session and opens the dashboard after login', async () => {
    authApi.login.mockResolvedValue(session)
    const { router, wrapper } = await mountPage(LoginPage, '/login')

    await fillLoginForm(wrapper)
    await getForm(wrapper, 'Login form').trigger('submit')
    await flushPromises()

    expect(authApi.login).toHaveBeenCalledExactlyOnceWith({
      email: 'owner@example.test',
      password: 'test-password',
    })
    expect(getAccessToken()).toBe('test-token')
    expect(localStorage.getItem('virelio.accessToken')).toBe('test-token')
    expect(isAuthenticated.value).toBe(true)
    expect(router.currentRoute.value.path).toBe('/')
  })

  it('honors the redirect query after login', async () => {
    authApi.login.mockResolvedValue(session)
    const { router, wrapper } = await mountPage(
      LoginPage,
      '/login?redirect=%2Fexpenses%3Fsearch%3Dflight',
    )

    await fillLoginForm(wrapper)
    await getForm(wrapper, 'Login form').trigger('submit')
    await flushPromises()

    expect(router.currentRoute.value.fullPath).toBe('/expenses?search=flight')
  })

  it('shows local login validation errors', async () => {
    const { wrapper } = await mountPage(LoginPage, '/login')

    await wrapper.get('#login-email').setValue('invalid')
    await wrapper.get('#login-password').setValue('short')
    await getForm(wrapper, 'Login form').trigger('submit')

    expect(wrapper.text()).toContain('Email must be a valid email address')
    expect(wrapper.text()).toContain('Password must be at least 8 characters')
    expectInvalidField(wrapper, '#login-email', 'login-email-error')
    expectInvalidField(wrapper, '#login-password', 'login-password-error')
    expect(authApi.login).not.toHaveBeenCalled()
  })

  it('shows rejected login errors without creating a session', async () => {
    authApi.login.mockRejectedValue(new ApiError('invalid credentials'))
    const { wrapper } = await mountPage(LoginPage, '/login')

    await fillLoginForm(wrapper)
    await getForm(wrapper, 'Login form').trigger('submit')
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toBe('Invalid credentials')
    expect(getAccessToken()).toBeNull()
    expect(isAuthenticated.value).toBe(false)
  })

  it('guides unverified users to request a new verification link', async () => {
    authApi.login.mockRejectedValue(new ApiError('Email address must be verified'))
    const { wrapper } = await mountPage(LoginPage, '/login')

    await fillLoginForm(wrapper)
    await getForm(wrapper, 'Login form').trigger('submit')
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toContain('Email address must be verified')
    expect(wrapper.get('a[href="/resend-verification"]').text()).toBe(
      'Send a new verification link',
    )
  })

  it('explains that a new account needs email verification', async () => {
    const { wrapper } = await mountPage(LoginPage, '/login?verification=pending')

    expect(wrapper.get('[role="status"]').text()).toContain('Check your inbox')
  })
})

describe('registration workflow', () => {
  it('presents account context and registration affordances', async () => {
    const { wrapper } = await mountPage(RegisterPage, '/register')

    const accountContext = wrapper.get('[aria-label="Account benefits"]')

    expect(wrapper.get('h1').text()).toBe('Give every expense a reliable home.')
    expect(wrapper.get('h2').text()).toBe('Create your account')
    expect(accountContext.text()).toContain('Expense proof stays with the original record')
    expect(accountContext.findAll('li')).toHaveLength(3)
    expect(wrapper.get('[aria-label="Virelio brand"]').text()).toContain('Virelio')
    expect(accountContext.classes()).toEqual(expect.arrayContaining(['hidden', 'lg:flex']))
    expect(accountContext.classes()).toContain('bg-surface-raised')
    expect(accountContext.classes()).not.toContain('bg-brand-strong')
    expect(wrapper.get('[data-auth-compact-brand]').classes()).toContain('lg:hidden')
    expect(wrapper.get('#register-full-name').attributes('autocomplete')).toBe('name')
    expect(wrapper.get('#register-email').attributes('autocomplete')).toBe('email')
    expect(wrapper.get('#register-password').attributes('autocomplete')).toBe('new-password')
    expect(wrapper.get('#register-password-confirmation').attributes('autocomplete')).toBe(
      'new-password',
    )
    expect(wrapper.get('[aria-label="Show passwords"]').attributes('aria-label')).toBe(
      'Show passwords',
    )
  })

  it('reveals and hides both registration passwords', async () => {
    const { wrapper } = await mountPage(RegisterPage, '/register')

    await wrapper.get('[aria-label="Show passwords"]').trigger('click')
    expect(wrapper.get('#register-password').attributes('type')).toBe('text')
    expect(wrapper.get('#register-password-confirmation').attributes('type')).toBe('text')

    await wrapper.get('[aria-label="Hide passwords"]').trigger('click')
    expect(wrapper.get('#register-password').attributes('type')).toBe('password')
    expect(wrapper.get('#register-password-confirmation').attributes('type')).toBe('password')
  })

  it('registers an account and opens the login page with verification guidance', async () => {
    authApi.register.mockResolvedValue(user)
    const { router, wrapper } = await mountPage(RegisterPage, '/register')

    await fillRegistrationForm(wrapper)
    await getForm(wrapper, 'Registration form').trigger('submit')
    await flushPromises()

    expect(authApi.register).toHaveBeenCalledExactlyOnceWith({
      fullName: 'Local Owner',
      email: 'owner@example.test',
      password: 'test-password',
      passwordConfirmation: 'test-password',
    })
    expect(router.currentRoute.value.fullPath).toBe('/login?verification=pending')
  })

  it('shows registration validation errors', async () => {
    const { wrapper } = await mountPage(RegisterPage, '/register')

    await wrapper.get('#register-full-name').setValue('A')
    await wrapper.get('#register-email').setValue('invalid')
    await wrapper.get('#register-password').setValue('test-password')
    await wrapper.get('#register-password-confirmation').setValue('different-password')
    await getForm(wrapper, 'Registration form').trigger('submit')

    expect(wrapper.text()).toContain('Full name is required')
    expect(wrapper.text()).toContain('Email must be a valid email address')
    expect(wrapper.text()).toContain('Passwords do not match')
    expectInvalidField(wrapper, '#register-full-name', 'register-full-name-error')
    expectInvalidField(wrapper, '#register-email', 'register-email-error')
    expectInvalidField(
      wrapper,
      '#register-password-confirmation',
      'register-password-confirmation-error',
    )
    expect(authApi.register).not.toHaveBeenCalled()
  })

  it('shows registration API field errors', async () => {
    authApi.register.mockRejectedValue(
      new ApiError('invalid form input', { email: 'Email is already registered' }),
    )
    const { wrapper } = await mountPage(RegisterPage, '/register')

    await fillRegistrationForm(wrapper)
    await getForm(wrapper, 'Registration form').trigger('submit')
    await flushPromises()

    expectInvalidField(wrapper, '#register-email', 'register-email-error')
    expect(wrapper.get('#register-email-error').text()).toBe('Email is already registered')
  })
})

describe('password reset confirmation workflow', () => {
  it('resets the password from a valid link and confirms completion', async () => {
    authApi.confirmPasswordReset.mockResolvedValue({ message: 'Password reset successfully' })
    const { wrapper } = await mountPage(
      PasswordResetConfirmPage,
      '/reset-password?token=reset-token',
    )

    await fillPasswordResetConfirmationForm(wrapper)
    await getForm(wrapper, 'Password reset confirmation form').trigger('submit')
    await flushPromises()

    expect(authApi.confirmPasswordReset).toHaveBeenCalledExactlyOnceWith({
      token: 'reset-token',
      password: 'new-password',
      passwordConfirmation: 'new-password',
    })
    expect(wrapper.get('[role="status"]').text()).toContain('Password reset successfully')
    expect(wrapper.get('a[href="/login"]').text()).toBe('Go to sign in')
  })

  it('shows an error when the reset link has no token', async () => {
    const { wrapper } = await mountPage(PasswordResetConfirmPage, '/reset-password')

    await fillPasswordResetConfirmationForm(wrapper)
    await getForm(wrapper, 'Password reset confirmation form').trigger('submit')

    expect(wrapper.get('[role="alert"]').text()).toBe('Reset token is required')
    expect(authApi.confirmPasswordReset).not.toHaveBeenCalled()
  })
})

describe('email verification workflow', () => {
  it('confirms a valid verification link', async () => {
    authApi.confirmEmailVerification.mockResolvedValue({ message: 'Email verified successfully' })
    const { wrapper } = await mountPage(
      EmailVerificationPage,
      '/verify-email?token=verification-token',
    )

    expect(authApi.confirmEmailVerification).toHaveBeenCalledExactlyOnceWith({
      token: 'verification-token',
    })
    expect(wrapper.get('[role="status"]').text()).toContain('Email verified successfully')
    expect(wrapper.get('a[href="/login"]').text()).toBe('Go to sign in')
    expect(wrapper.get('a[href="/resend-verification"]').text()).toBe('Resend verification email')
  })

  it('shows the backend error for an invalid or expired link', async () => {
    authApi.confirmEmailVerification.mockRejectedValue(
      new ApiError('This link is invalid or has expired'),
    )
    const { wrapper } = await mountPage(EmailVerificationPage, '/verify-email?token=invalid-token')

    expect(wrapper.get('[role="alert"]').text()).toBe('This link is invalid or has expired')
  })

  it('shows an error when the verification link has no token', async () => {
    const { wrapper } = await mountPage(EmailVerificationPage, '/verify-email')

    expect(wrapper.get('[role="alert"]').text()).toBe('Verification token is required')
    expect(authApi.confirmEmailVerification).not.toHaveBeenCalled()
  })
})

describe('email verification resend workflow', () => {
  it('requests a verification link without revealing account existence', async () => {
    authApi.resendEmailVerification.mockResolvedValue({
      message: 'If an account exists for that email, a verification link has been sent.',
    })
    const { wrapper } = await mountPage(ResendVerificationPage, '/resend-verification')

    await wrapper.get('#resend-verification-email').setValue('owner@example.test')
    await getForm(wrapper, 'Resend verification form').trigger('submit')
    await flushPromises()

    expect(authApi.resendEmailVerification).toHaveBeenCalledExactlyOnceWith({
      email: 'owner@example.test',
    })
    expect(wrapper.get('[role="status"]').text()).toBe(
      'If an account exists for that email, a verification link has been sent.',
    )
  })
})
