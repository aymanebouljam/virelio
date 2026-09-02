<script setup lang="ts">
import { computed, ref } from 'vue'
import { ZodError } from 'zod'
import { Check, Clock3, Eye, EyeOff, KeyRound, Save } from '@lucide/vue'
import LedgerSurface from '@/components/ui/LedgerSurface.vue'
import WorkspaceHeader from '@/components/ui/WorkspaceHeader.vue'
import { ApiError } from '@/lib/api'
import { changePassword, requestPasswordReset, updateProfile } from '@/lib/auth/api'
import {
  changePasswordFormSchema,
  profileFormSchema,
  type ChangePasswordFormValues,
  type ProfileFormValues,
} from '@/lib/auth/schema'
import { currentUser, setAccessToken } from '@/lib/auth/storage'
import { formatDateTime, formatRelativeDate, getInitials } from '@/lib/helpers'
import { mapZodErrors } from '@/lib/zod'

const initialProfile: ProfileFormValues = {
  fullName: currentUser.value?.fullName ?? '',
  email: currentUser.value?.email ?? '',
}
const form = ref<ProfileFormValues>({ ...initialProfile })
const baseline = ref<ProfileFormValues>({ ...initialProfile })
const formErrors = ref<Record<string, string>>({})
const submitError = ref('')
const successMessage = ref('')
const submitting = ref(false)
const passwordForm = ref<ChangePasswordFormValues>({
  currentPassword: '',
  password: '',
  passwordConfirmation: '',
})
const passwordFormErrors = ref<Record<string, string>>({})
const passwordSubmitError = ref('')
const passwordSuccessMessage = ref('')
const passwordSubmitting = ref(false)
const passwordResetting = ref(false)
const passwordFormOpen = ref(false)
const showCurrentPassword = ref(false)
const showNewPassword = ref(false)
const showPasswordConfirmation = ref(false)
const unchanged = computed(
  () =>
    form.value.fullName === baseline.value.fullName && form.value.email === baseline.value.email,
)
const passwordUnchanged = computed(
  () =>
    passwordForm.value.currentPassword === '' &&
    passwordForm.value.password === '' &&
    passwordForm.value.passwordConfirmation === '',
)
const profileInitials = computed(() =>
  getInitials(currentUser.value?.fullName ?? form.value.fullName),
)

function normalizeError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.content) {
      formErrors.value = error.content
      return
    }
    submitError.value = error.message
    return
  }

  if (error instanceof ZodError) {
    formErrors.value = mapZodErrors(error.issues)
    return
  }

  submitError.value = 'Something went wrong'
}

function normalizePasswordError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.content) {
      passwordFormErrors.value = error.content
      return
    }
    passwordSubmitError.value = error.message
    return
  }

  if (error instanceof ZodError) {
    passwordFormErrors.value = mapZodErrors(error.issues)
    return
  }

  passwordSubmitError.value = 'Something went wrong'
}

async function submit() {
  formErrors.value = {}
  submitError.value = ''
  successMessage.value = ''
  submitting.value = true

  try {
    const profile = profileFormSchema.parse(form.value)
    const updatedUser = await updateProfile(profile)
    currentUser.value = updatedUser
    form.value = { fullName: updatedUser.fullName, email: updatedUser.email }
    baseline.value = { ...form.value }
    successMessage.value = 'Profile updated'
  } catch (error) {
    normalizeError(error)
  } finally {
    submitting.value = false
  }
}

async function submitPasswordChange() {
  passwordFormErrors.value = {}
  passwordSubmitError.value = ''
  passwordSuccessMessage.value = ''
  passwordSubmitting.value = true

  try {
    const passwordInput = changePasswordFormSchema.parse(passwordForm.value)
    const { accessToken } = await changePassword(passwordInput)
    setAccessToken(accessToken)
    passwordForm.value = {
      currentPassword: '',
      password: '',
      passwordConfirmation: '',
    }
    passwordSuccessMessage.value = 'Password updated'
  } catch (error) {
    normalizePasswordError(error)
  } finally {
    passwordSubmitting.value = false
  }
}

async function requestPasswordResetEmail() {
  if (!currentUser.value) return

  passwordSubmitError.value = ''
  passwordSuccessMessage.value = ''
  passwordResetting.value = true

  try {
    const response = await requestPasswordReset({ email: currentUser.value.email })
    passwordSuccessMessage.value = response.message
  } catch (error) {
    normalizePasswordError(error)
  } finally {
    passwordResetting.value = false
  }
}
</script>

<template>
  <section class="min-w-0 space-y-6">
    <WorkspaceHeader
      context="Account"
      title="Profile settings"
      description="Update the details used across your workspace."
    />

    <div class="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
      <LedgerSurface aria-label="Profile settings form" data-profile-record class="overflow-hidden">
        <form aria-label="Profile settings form" @submit.prevent="submit">
          <header class="flex min-w-0 items-center gap-3 border-b border-line px-5 py-4 sm:px-6">
            <span
              data-profile-initials
              class="font-figure flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-base font-semibold tracking-[0.04em] text-white shadow-card"
              aria-hidden="true"
            >
              {{ profileInitials }}
            </span>
            <div class="min-w-0">
              <h2
                class="font-display break-words text-lg font-semibold tracking-[-0.02em] text-ink"
              >
                Identity details
              </h2>
              <p class="text-xs leading-5 text-ink-muted">
                Used to identify you throughout your workspace.
              </p>
            </div>
          </header>

          <div class="space-y-5 p-5 sm:p-6">
            <div class="space-y-1.5">
              <label for="profile-full-name" class="text-sm font-medium text-ink">Full name</label>
              <input
                id="profile-full-name"
                v-model="form.fullName"
                name="fullName"
                type="text"
                autocomplete="name"
                maxlength="120"
                :aria-describedby="formErrors.fullName ? 'profile-full-name-error' : undefined"
                :aria-invalid="Boolean(formErrors.fullName)"
                :class="[
                  'min-h-11 w-full rounded-lg border bg-surface-raised px-3 py-2 text-sm text-ink outline-none transition hover:border-line-strong focus:bg-surface',
                  formErrors.fullName
                    ? 'border-danger focus:border-danger'
                    : 'border-line focus:border-brand',
                ]"
              />
              <p
                v-if="formErrors.fullName"
                id="profile-full-name-error"
                class="text-sm text-danger"
              >
                {{ formErrors.fullName }}
              </p>
            </div>

            <div class="space-y-1.5">
              <label for="profile-email" class="text-sm font-medium text-ink">Email address</label>
              <input
                id="profile-email"
                v-model="form.email"
                name="email"
                type="email"
                autocomplete="email"
                maxlength="254"
                :aria-describedby="formErrors.email ? 'profile-email-error' : undefined"
                :aria-invalid="Boolean(formErrors.email)"
                :class="[
                  'min-h-11 w-full rounded-lg border bg-surface-raised px-3 py-2 text-sm text-ink outline-none transition hover:border-line-strong focus:bg-surface',
                  formErrors.email
                    ? 'border-danger focus:border-danger'
                    : 'border-line focus:border-brand',
                ]"
              />
              <p v-if="formErrors.email" id="profile-email-error" class="text-sm text-danger">
                {{ formErrors.email }}
              </p>
            </div>

            <p
              v-if="submitError"
              role="alert"
              class="rounded-lg border border-danger/25 bg-danger-soft px-4 py-3 text-sm text-danger"
            >
              {{ submitError }}
            </p>
            <p
              v-if="successMessage"
              role="status"
              class="flex items-center gap-2 rounded-lg border border-success/25 bg-success-soft px-4 py-3 text-sm text-success"
            >
              <Check :size="16" aria-hidden="true" />
              {{ successMessage }}
            </p>
          </div>

          <footer
            class="flex flex-col gap-2 border-t border-line bg-surface-raised px-5 py-4 sm:flex-row sm:justify-end sm:px-6"
          >
            <button
              type="submit"
              :disabled="submitting || unchanged"
              class="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg bg-brand px-4 text-sm font-semibold text-white transition hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-45 sm:min-h-10 sm:w-auto"
            >
              <Save :size="15" aria-hidden="true" />
              {{ submitting ? 'Saving...' : 'Save changes' }}
            </button>
          </footer>
        </form>
      </LedgerSurface>

      <LedgerSurface v-if="currentUser" tone="quiet" class="relative overflow-hidden p-5 sm:p-6">
        <span class="absolute inset-y-0 left-0 w-1 bg-accent" aria-hidden="true" />
        <header class="min-w-0 border-b border-line pb-5">
          <p class="text-xs font-semibold tracking-[0.08em] text-evidence">Account</p>
          <h2
            class="font-display mt-1 break-words text-lg font-semibold tracking-[-0.02em] text-ink"
          >
            Account history
          </h2>
        </header>

        <dl class="divide-y divide-line text-sm">
          <div class="relative min-w-0 py-4">
            <dt class="text-xs font-medium text-ink-muted">Current identity</dt>
            <dd class="mt-2 break-words text-sm font-semibold text-ink">
              {{ currentUser.fullName }}
            </dd>
            <dd class="mt-1 break-words text-sm text-ink-muted">{{ currentUser.email }}</dd>
            <dd class="absolute right-0 top-4">
              <span
                class="inline-flex border-l-2 border-success pl-2 text-xs font-semibold text-success"
              >
                Active account
              </span>
            </dd>
          </div>
          <div class="py-4">
            <dt class="flex items-center gap-2 text-xs font-medium text-ink-muted">
              <Clock3 :size="14" aria-hidden="true" />
              Member since
            </dt>
            <dd class="font-figure mt-1.5 text-ink">
              <time
                :datetime="currentUser.createdAt"
                :title="formatDateTime(currentUser.createdAt)"
              >
                {{ formatRelativeDate(currentUser.createdAt) }}
              </time>
            </dd>
          </div>
          <div class="pb-0 pt-4">
            <dt class="flex items-center gap-2 text-xs font-medium text-ink-muted">
              <Clock3 :size="14" aria-hidden="true" />
              Last updated
            </dt>
            <dd class="font-figure mt-1.5 text-ink">
              <time
                :datetime="currentUser.updatedAt"
                :title="formatDateTime(currentUser.updatedAt)"
              >
                {{ formatRelativeDate(currentUser.updatedAt) }}
              </time>
            </dd>
          </div>
        </dl>
      </LedgerSurface>
    </div>

    <LedgerSurface aria-label="Password settings" class="overflow-hidden">
      <header class="flex min-w-0 flex-wrap items-center gap-3 px-5 py-4 sm:px-6">
        <span
          class="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand"
          aria-hidden="true"
        >
          <KeyRound :size="18" />
        </span>
        <div class="min-w-0">
          <h2 class="font-display text-lg font-semibold tracking-[-0.02em] text-ink">Password</h2>
          <p class="text-xs leading-5 text-ink-muted">
            Use your current password to set a new one.
          </p>
        </div>
        <button
          v-if="!passwordFormOpen"
          type="button"
          data-change-password
          class="ml-auto inline-flex min-h-10 shrink-0 items-center justify-center rounded-lg border border-line px-3 text-sm font-semibold text-brand transition hover:border-line-strong hover:bg-surface-raised"
          @click="passwordFormOpen = true"
        >
          Change password
        </button>
      </header>

      <form
        v-if="passwordFormOpen"
        aria-label="Password settings form"
        class="border-t border-line"
        @submit.prevent="submitPasswordChange"
      >
        <div class="grid gap-5 p-5 sm:p-6 lg:grid-cols-3">
          <div class="space-y-1.5">
            <label for="current-password" class="text-sm font-medium text-ink"
              >Current password</label
            >
            <div class="relative">
              <input
                id="current-password"
                v-model="passwordForm.currentPassword"
                :type="showCurrentPassword ? 'text' : 'password'"
                autocomplete="current-password"
                :aria-describedby="
                  passwordFormErrors.currentPassword ? 'current-password-error' : undefined
                "
                :aria-invalid="Boolean(passwordFormErrors.currentPassword)"
                class="min-h-11 w-full rounded-lg border border-line bg-surface-raised px-3 py-2 pr-12 text-sm text-ink outline-none transition hover:border-line-strong focus:border-brand focus:bg-surface"
              />
              <button
                type="button"
                data-toggle-current-password
                class="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-ink-muted transition hover:bg-surface-muted hover:text-ink"
                :aria-label="
                  showCurrentPassword ? 'Hide current password' : 'Show current password'
                "
                @click="showCurrentPassword = !showCurrentPassword"
              >
                <EyeOff v-if="showCurrentPassword" :size="18" aria-hidden="true" />
                <Eye v-else :size="18" aria-hidden="true" />
              </button>
            </div>
            <p
              v-if="passwordFormErrors.currentPassword"
              id="current-password-error"
              class="text-sm text-danger"
            >
              {{ passwordFormErrors.currentPassword }}
            </p>
          </div>

          <div class="space-y-1.5">
            <label for="new-password" class="text-sm font-medium text-ink">New password</label>
            <div class="relative">
              <input
                id="new-password"
                v-model="passwordForm.password"
                :type="showNewPassword ? 'text' : 'password'"
                autocomplete="new-password"
                :aria-describedby="passwordFormErrors.password ? 'new-password-error' : undefined"
                :aria-invalid="Boolean(passwordFormErrors.password)"
                class="min-h-11 w-full rounded-lg border border-line bg-surface-raised px-3 py-2 pr-12 text-sm text-ink outline-none transition hover:border-line-strong focus:border-brand focus:bg-surface"
              />
              <button
                type="button"
                data-toggle-new-password
                class="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-ink-muted transition hover:bg-surface-muted hover:text-ink"
                :aria-label="showNewPassword ? 'Hide new password' : 'Show new password'"
                @click="showNewPassword = !showNewPassword"
              >
                <EyeOff v-if="showNewPassword" :size="18" aria-hidden="true" />
                <Eye v-else :size="18" aria-hidden="true" />
              </button>
            </div>
            <p
              v-if="passwordFormErrors.password"
              id="new-password-error"
              class="text-sm text-danger"
            >
              {{ passwordFormErrors.password }}
            </p>
          </div>

          <div class="space-y-1.5">
            <label for="new-password-confirmation" class="text-sm font-medium text-ink"
              >Confirm new password</label
            >
            <div class="relative">
              <input
                id="new-password-confirmation"
                v-model="passwordForm.passwordConfirmation"
                :type="showPasswordConfirmation ? 'text' : 'password'"
                autocomplete="new-password"
                :aria-describedby="
                  passwordFormErrors.passwordConfirmation
                    ? 'new-password-confirmation-error'
                    : undefined
                "
                :aria-invalid="Boolean(passwordFormErrors.passwordConfirmation)"
                class="min-h-11 w-full rounded-lg border border-line bg-surface-raised px-3 py-2 pr-12 text-sm text-ink outline-none transition hover:border-line-strong focus:border-brand focus:bg-surface"
              />
              <button
                type="button"
                data-toggle-password-confirmation
                class="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-ink-muted transition hover:bg-surface-muted hover:text-ink"
                :aria-label="
                  showPasswordConfirmation
                    ? 'Hide password confirmation'
                    : 'Show password confirmation'
                "
                @click="showPasswordConfirmation = !showPasswordConfirmation"
              >
                <EyeOff v-if="showPasswordConfirmation" :size="18" aria-hidden="true" />
                <Eye v-else :size="18" aria-hidden="true" />
              </button>
            </div>
            <p
              v-if="passwordFormErrors.passwordConfirmation"
              id="new-password-confirmation-error"
              class="text-sm text-danger"
            >
              {{ passwordFormErrors.passwordConfirmation }}
            </p>
          </div>

          <div class="md:col-span-3">
            <p
              v-if="passwordSubmitError"
              role="alert"
              class="rounded-lg border border-danger/25 bg-danger-soft px-4 py-3 text-sm text-danger"
            >
              {{ passwordSubmitError }}
            </p>
            <p
              v-if="passwordSuccessMessage"
              role="status"
              class="flex items-center gap-2 rounded-lg border border-success/25 bg-success-soft px-4 py-3 text-sm text-success"
            >
              <Check :size="16" aria-hidden="true" />
              {{ passwordSuccessMessage }}
            </p>
          </div>
        </div>

        <footer
          class="flex flex-col gap-3 border-t border-line bg-surface-raised px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"
        >
          <button
            type="button"
            data-password-reset
            :disabled="passwordResetting"
            class="w-fit text-sm font-semibold text-brand underline-offset-4 hover:text-brand-strong hover:underline disabled:cursor-not-allowed disabled:opacity-60"
            @click="requestPasswordResetEmail"
          >
            {{ passwordResetting ? 'Sending reset email...' : 'Forgot your current password?' }}
          </button>
          <button
            type="submit"
            :disabled="passwordSubmitting || passwordUnchanged"
            class="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg bg-brand px-4 text-sm font-semibold text-white transition hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-45 sm:min-h-10 sm:w-auto"
          >
            <Save :size="15" aria-hidden="true" />
            {{ passwordSubmitting ? 'Updating password...' : 'Update password' }}
          </button>
        </footer>
      </form>
    </LedgerSurface>
  </section>
</template>
