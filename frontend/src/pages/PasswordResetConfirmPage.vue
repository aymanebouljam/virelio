<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowRight, Eye, EyeOff } from '@lucide/vue'
import AuthFrame from '@/components/auth/AuthFrame.vue'
import { confirmPasswordReset } from '@/lib/auth/api'
import {
  passwordResetConfirmFormSchema,
  type PasswordResetConfirmFormValues,
} from '@/lib/auth/schema'
import { setAccessToken } from '@/lib/auth/storage'
import { useFormErrors } from '@/lib/use-form-errors'

const route = useRoute()
const router = useRouter()
const token = typeof route.query.token === 'string' ? route.query.token : ''

const form = ref<PasswordResetConfirmFormValues>({
  token,
  password: '',
  passwordConfirmation: '',
})

const { formErrors, submitError, clearErrors, setError } = useFormErrors()
const submitting = ref(false)
const showPasswords = ref(false)

const accountBenefits = [
  'Choose a new password for your private workspace',
  'Your reset link can only be used once',
  'Return to your expense record securely',
]

async function submit() {
  clearErrors()
  submitting.value = true

  try {
    passwordResetConfirmFormSchema.parse(form.value)
    const { accessToken } = await confirmPasswordReset(form.value)
    setAccessToken(accessToken)
    await router.replace('/')
  } catch (err) {
    setError(err)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <AuthFrame
    panel-eyebrow="Finish securely"
    panel-title="Set a new password for your workspace."
    panel-description="Choose a strong password, then return to your expense record with a fresh sign-in."
    :benefits="accountBenefits"
    form-eyebrow="Password reset"
    form-title="Choose a new password"
    form-description="Your new password must be at least eight characters long."
  >
    <form
      aria-label="Password reset confirmation form"
      class="mt-7 space-y-5"
      @submit.prevent="submit"
    >
      <div class="space-y-1.5">
        <label for="password-reset-password" class="text-sm font-medium text-ink"
          >New password</label
        >
        <div class="relative">
          <input
            id="password-reset-password"
            v-model="form.password"
            :type="showPasswords ? 'text' : 'password'"
            autocomplete="new-password"
            :aria-describedby="formErrors.password ? 'password-reset-password-error' : undefined"
            :aria-invalid="Boolean(formErrors.password)"
            class="min-h-11 w-full rounded-lg border border-line bg-surface-raised px-3 py-2 pr-12 text-sm text-ink outline-none transition hover:border-line-strong focus:border-brand focus:bg-surface"
          />
          <button
            type="button"
            class="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-ink-muted transition hover:bg-surface-muted hover:text-ink"
            :aria-label="showPasswords ? 'Hide passwords' : 'Show passwords'"
            @click="showPasswords = !showPasswords"
          >
            <EyeOff v-if="showPasswords" :size="18" aria-hidden="true" />
            <Eye v-else :size="18" aria-hidden="true" />
          </button>
        </div>
        <p
          v-if="formErrors.password"
          id="password-reset-password-error"
          class="text-sm text-danger"
        >
          {{ formErrors.password }}
        </p>
      </div>

      <div class="space-y-1.5">
        <label for="password-reset-password-confirmation" class="text-sm font-medium text-ink">
          Confirm new password
        </label>
        <input
          id="password-reset-password-confirmation"
          v-model="form.passwordConfirmation"
          :type="showPasswords ? 'text' : 'password'"
          autocomplete="new-password"
          :aria-describedby="
            formErrors.passwordConfirmation
              ? 'password-reset-password-confirmation-error'
              : undefined
          "
          :aria-invalid="Boolean(formErrors.passwordConfirmation)"
          class="min-h-11 w-full rounded-lg border border-line bg-surface-raised px-3 py-2 text-sm text-ink outline-none transition hover:border-line-strong focus:border-brand focus:bg-surface"
        />
        <p
          v-if="formErrors.passwordConfirmation"
          id="password-reset-password-confirmation-error"
          class="text-sm text-danger"
        >
          {{ formErrors.passwordConfirmation }}
        </p>
      </div>

      <div
        v-if="formErrors.token || submitError"
        role="alert"
        class="rounded-lg border border-danger/25 bg-danger-soft px-4 py-3 text-sm text-danger"
      >
        {{ formErrors.token ?? submitError }}
      </div>

      <button
        type="submit"
        :disabled="submitting"
        class="group inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-white transition hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-60"
      >
        {{ submitting ? 'Resetting password...' : 'Reset password' }}
        <ArrowRight
          v-if="!submitting"
          :size="16"
          class="transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </button>
    </form>

    <template #footer>
      <p>
        Remember your password?
        <RouterLink
          to="/login"
          class="font-semibold text-brand underline-offset-4 hover:text-brand-strong hover:underline"
        >
          Sign in
        </RouterLink>
      </p>
    </template>
  </AuthFrame>
</template>
