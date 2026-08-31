<script setup lang="ts">
import { ref } from 'vue'
import { ArrowRight, Eye, EyeOff } from '@lucide/vue'
import AuthFrame from '@/components/auth/AuthFrame.vue'
import { ApiError } from '@/lib/api'
import { register as registerUser } from '@/lib/auth/api'
import { registerFormSchema, type RegisterFormValues } from '@/lib/auth/schema'
import { ZodError } from 'zod'
import { mapZodErrors } from '@/lib/zod'

const form = ref<RegisterFormValues>({
  fullName: '',
  email: '',
  password: '',
  passwordConfirmation: '',
})

const formErrors = ref<Record<string, string>>({})
const submitError = ref('')
const submitting = ref(false)
const showPasswords = ref(false)
const registrationComplete = ref(false)
const registeredEmail = ref('')

const accountBenefits = [
  'A private ledger scoped to your account',
  'Expense proof stays with the original record',
  'Recurring costs remain visible and reviewable',
]

function resetForm() {
  form.value = {
    fullName: '',
    email: '',
    password: '',
    passwordConfirmation: '',
  }
  submitError.value = ''
  formErrors.value = {}
}

function normalizeError(err: unknown) {
  if (err instanceof ApiError) {
    if (err.content) {
      formErrors.value = err.content
      return
    }
    submitError.value = err.message
    return
  }
  if (err instanceof ZodError) {
    formErrors.value = mapZodErrors(err.issues)
    return
  }
  submitError.value = 'Something went wrong'
}

async function submit() {
  formErrors.value = {}
  submitError.value = ''
  submitting.value = true
  try {
    registerFormSchema.parse(form.value)
    registeredEmail.value = form.value.email
    await registerUser(form.value)
    resetForm()
    registrationComplete.value = true
  } catch (err) {
    normalizeError(err)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <AuthFrame
    panel-eyebrow="Start with a clear record"
    panel-title="Give every expense a reliable home."
    panel-description="Create a private ledger for purchases, repeat costs, vendors, and the proof behind each entry."
    :benefits="accountBenefits"
    form-eyebrow="Create your workspace"
    form-title="Create your account"
    form-description="Set up your private Virelio workspace in a moment."
  >
    <div v-if="registrationComplete" role="status" class="mt-7 space-y-5">
      <p class="rounded-lg border border-success/25 bg-success-soft px-4 py-3 text-sm text-success">
        Your account is ready. We sent a verification link to {{ registeredEmail }}.
      </p>

      <RouterLink
        :to="{ path: '/resend-verification', query: { email: registeredEmail } }"
        class="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-brand px-4 text-sm font-semibold text-white transition hover:bg-brand-strong"
      >
        Resend verification email
      </RouterLink>
    </div>

    <form v-else aria-label="Registration form" class="mt-7 space-y-4" @submit.prevent="submit">
      <div class="space-y-1.5">
        <label for="register-full-name" class="text-sm font-medium text-ink">Full name</label>
        <input
          id="register-full-name"
          v-model="form.fullName"
          type="text"
          autocomplete="name"
          placeholder="Your name"
          :aria-describedby="formErrors.fullName ? 'register-full-name-error' : undefined"
          :aria-invalid="Boolean(formErrors.fullName)"
          class="min-h-11 w-full rounded-lg border border-line bg-surface-raised px-3 py-2 text-sm text-ink outline-none transition placeholder:text-ink-muted/65 hover:border-line-strong focus:border-brand focus:bg-surface"
        />
        <p v-if="formErrors.fullName" id="register-full-name-error" class="text-sm text-danger">
          {{ formErrors.fullName }}
        </p>
      </div>

      <div class="space-y-1.5">
        <label for="register-email" class="text-sm font-medium text-ink">Email address</label>
        <input
          id="register-email"
          v-model="form.email"
          type="email"
          autocomplete="email"
          placeholder="you@example.com"
          :aria-describedby="formErrors.email ? 'register-email-error' : undefined"
          :aria-invalid="Boolean(formErrors.email)"
          class="min-h-11 w-full rounded-lg border border-line bg-surface-raised px-3 py-2 text-sm text-ink outline-none transition placeholder:text-ink-muted/65 hover:border-line-strong focus:border-brand focus:bg-surface"
        />
        <p v-if="formErrors.email" id="register-email-error" class="text-sm text-danger">
          {{ formErrors.email }}
        </p>
      </div>

      <div class="space-y-1.5">
        <label for="register-password" class="text-sm font-medium text-ink">Password</label>
        <div class="relative">
          <input
            id="register-password"
            v-model="form.password"
            :type="showPasswords ? 'text' : 'password'"
            autocomplete="new-password"
            :aria-describedby="formErrors.password ? 'register-password-error' : undefined"
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
        <p v-if="formErrors.password" id="register-password-error" class="text-sm text-danger">
          {{ formErrors.password }}
        </p>
      </div>

      <div class="space-y-1.5">
        <label for="register-password-confirmation" class="text-sm font-medium text-ink">
          Confirm password
        </label>
        <input
          id="register-password-confirmation"
          v-model="form.passwordConfirmation"
          :type="showPasswords ? 'text' : 'password'"
          autocomplete="new-password"
          :aria-describedby="
            formErrors.passwordConfirmation ? 'register-password-confirmation-error' : undefined
          "
          :aria-invalid="Boolean(formErrors.passwordConfirmation)"
          class="min-h-11 w-full rounded-lg border border-line bg-surface-raised px-3 py-2 text-sm text-ink outline-none transition hover:border-line-strong focus:border-brand focus:bg-surface"
        />
        <p
          v-if="formErrors.passwordConfirmation"
          id="register-password-confirmation-error"
          class="text-sm text-danger"
        >
          {{ formErrors.passwordConfirmation }}
        </p>
      </div>

      <div
        v-if="submitError"
        role="alert"
        class="rounded-lg border border-danger/25 bg-danger-soft px-4 py-3 text-sm text-danger"
      >
        {{ submitError }}
      </div>

      <button
        type="submit"
        :disabled="submitting"
        class="group inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-white transition hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-60"
      >
        {{ submitting ? 'Creating account...' : 'Create account' }}
        <ArrowRight
          v-if="!submitting"
          :size="16"
          class="transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </button>
    </form>

    <template #footer>
      <p v-if="registrationComplete">
        Already verified your email?
        <RouterLink
          to="/login"
          class="font-semibold text-brand underline-offset-4 hover:text-brand-strong hover:underline"
        >
          Sign in
        </RouterLink>
      </p>
      <p v-else>
        Already have an account?
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
