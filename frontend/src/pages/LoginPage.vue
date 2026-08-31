<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowRight, Eye, EyeOff } from '@lucide/vue'
import AuthFrame from '@/components/auth/AuthFrame.vue'
import { ApiError } from '@/lib/api'
import { login as loginUser } from '@/lib/auth/api'
import { loginFormSchema, type LoginFormValues } from '@/lib/auth/schema'
import { ZodError } from 'zod'
import { mapZodErrors } from '@/lib/zod'
import { setAccessToken } from '@/lib/auth/storage'

const router = useRouter()

const form = ref<LoginFormValues>({
  email: '',
  password: '',
})

const formErrors = ref<Record<string, string>>({})
const submitError = ref('')
const submitting = ref(false)
const showPassword = ref(false)
const showVerificationHelp = ref(false)

const accountBenefits = [
  'Private, account-scoped records',
  'Proof stays attached to each expense',
  'Reports keep source details close',
]

function resetForm() {
  form.value = {
    email: '',
    password: '',
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
    showVerificationHelp.value = err.message === 'Email address must be verified'
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
  showVerificationHelp.value = false
  submitting.value = true

  try {
    loginFormSchema.parse(form.value)
    const session = await loginUser(form.value)
    setAccessToken(session.accessToken)
    const redirect = router.currentRoute.value.query.redirect
    const target = typeof redirect === 'string' && redirect.length > 0 ? redirect : '/'
    resetForm()
    await router.push(target)
  } catch (err) {
    normalizeError(err)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <AuthFrame
    panel-eyebrow="Your financial record"
    panel-title="Keep every expense in context."
    panel-description="Return to a ledger where purchases, repeat costs, vendors, and proof stay connected."
    :benefits="accountBenefits"
    form-eyebrow="Welcome back"
    form-title="Sign in to Virelio"
    form-description="Enter your details to continue to your workspace."
  >
    <form aria-label="Login form" class="mt-7 space-y-5" @submit.prevent="submit">
      <div class="space-y-1.5">
        <label for="login-email" class="text-sm font-medium text-ink">Email address</label>
        <input
          id="login-email"
          v-model="form.email"
          type="email"
          autocomplete="email"
          placeholder="you@example.com"
          :aria-describedby="formErrors.email ? 'login-email-error' : undefined"
          :aria-invalid="Boolean(formErrors.email)"
          class="min-h-11 w-full rounded-lg border border-line bg-surface-raised px-3 py-2 text-sm text-ink outline-none transition placeholder:text-ink-muted/65 hover:border-line-strong focus:border-brand focus:bg-surface"
        />
        <p v-if="formErrors.email" id="login-email-error" class="text-sm text-danger">
          {{ formErrors.email }}
        </p>
      </div>

      <div class="space-y-1.5">
        <label for="login-password" class="text-sm font-medium text-ink">Password</label>
        <div class="relative">
          <input
            id="login-password"
            v-model="form.password"
            :type="showPassword ? 'text' : 'password'"
            autocomplete="current-password"
            :aria-describedby="formErrors.password ? 'login-password-error' : undefined"
            :aria-invalid="Boolean(formErrors.password)"
            class="min-h-11 w-full rounded-lg border border-line bg-surface-raised px-3 py-2 pr-12 text-sm text-ink outline-none transition hover:border-line-strong focus:border-brand focus:bg-surface"
          />
          <button
            type="button"
            class="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-ink-muted transition hover:bg-surface-muted hover:text-ink"
            :aria-label="showPassword ? 'Hide password' : 'Show password'"
            @click="showPassword = !showPassword"
          >
            <EyeOff v-if="showPassword" :size="18" aria-hidden="true" />
            <Eye v-else :size="18" aria-hidden="true" />
          </button>
        </div>
        <p v-if="formErrors.password" id="login-password-error" class="text-sm text-danger">
          {{ formErrors.password }}
        </p>
      </div>

      <RouterLink
        to="/password-reset"
        class="block w-fit text-sm font-medium text-brand underline-offset-4 hover:text-brand-strong hover:underline"
      >
        Forgot your password?
      </RouterLink>

      <div
        v-if="submitError"
        role="alert"
        class="rounded-lg border border-danger/25 bg-danger-soft px-4 py-3 text-sm text-danger"
      >
        {{ submitError }}
        <RouterLink
          v-if="showVerificationHelp"
          to="/resend-verification"
          class="ml-1 font-semibold underline-offset-4 hover:underline"
        >
          Send a new verification link
        </RouterLink>
      </div>

      <button
        type="submit"
        :disabled="submitting"
        class="group inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-white transition hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-60"
      >
        {{ submitting ? 'Signing in...' : 'Sign in' }}
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
        New to Virelio?
        <RouterLink
          to="/register"
          class="font-semibold text-brand underline-offset-4 hover:text-brand-strong hover:underline"
        >
          Create an account
        </RouterLink>
      </p>
    </template>
  </AuthFrame>
</template>
