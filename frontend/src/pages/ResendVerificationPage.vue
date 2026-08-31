<script setup lang="ts">
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import { ArrowRight } from '@lucide/vue'
import { ZodError } from 'zod'
import AuthFrame from '@/components/auth/AuthFrame.vue'
import { ApiError } from '@/lib/api'
import { resendEmailVerification } from '@/lib/auth/api'
import {
  passwordResetRequestFormSchema,
  type PasswordResetRequestFormValues,
} from '@/lib/auth/schema'
import { mapZodErrors } from '@/lib/zod'

const route = useRoute()
const form = ref<PasswordResetRequestFormValues>({
  email: typeof route.query.email === 'string' ? route.query.email : '',
})

const formErrors = ref<Record<string, string>>({})
const submitError = ref('')
const successMessage = ref('')
const submitting = ref(false)
const emailSent = ref(false)

const accountBenefits = [
  'Your email confirms access to your workspace',
  'Verification links can only be used once',
  'Your expense record stays private to you',
]

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
  successMessage.value = ''
  submitting.value = true

  try {
    passwordResetRequestFormSchema.parse(form.value)
    const response = await resendEmailVerification(form.value)
    successMessage.value = response.message
    emailSent.value = true
  } catch (err) {
    normalizeError(err)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <AuthFrame
    panel-eyebrow="Secure your workspace"
    panel-title="Get a fresh verification link."
    panel-description="Request another link to confirm the email connected to your expense record."
    :benefits="accountBenefits"
    form-eyebrow="Email verification"
    form-title="Resend verification email"
    form-description="Enter your email address and we'll send a link if it needs verification."
  >
    <form aria-label="Resend verification form" class="mt-7 space-y-5" @submit.prevent="submit">
      <div class="space-y-1.5">
        <label for="resend-verification-email" class="text-sm font-medium text-ink"
          >Email address</label
        >
        <input
          id="resend-verification-email"
          v-model="form.email"
          @update:model-value="emailSent = false"
          type="email"
          autocomplete="email"
          placeholder="you@example.com"
          :aria-describedby="formErrors.email ? 'resend-verification-email-error' : undefined"
          :aria-invalid="Boolean(formErrors.email)"
          class="min-h-11 w-full rounded-lg border border-line bg-surface-raised px-3 py-2 text-sm text-ink outline-none transition placeholder:text-ink-muted/65 hover:border-line-strong focus:border-brand focus:bg-surface"
        />
        <p v-if="formErrors.email" id="resend-verification-email-error" class="text-sm text-danger">
          {{ formErrors.email }}
        </p>
      </div>

      <p
        v-if="successMessage"
        role="status"
        class="rounded-lg border border-success/25 bg-success-soft px-4 py-3 text-sm text-success"
      >
        {{ successMessage }}
      </p>

      <div
        v-if="submitError"
        role="alert"
        class="rounded-lg border border-danger/25 bg-danger-soft px-4 py-3 text-sm text-danger"
      >
        {{ submitError }}
      </div>

      <button
        type="submit"
        :disabled="submitting || emailSent"
        class="group inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-white transition hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-60"
      >
        {{
          submitting
            ? 'Sending verification link...'
            : emailSent
              ? 'Email sent'
              : 'Send verification link'
        }}
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
        Already verified your email?
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
