<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowRight, CheckCircle2, Eye, EyeOff } from '@lucide/vue'
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
  <section
    class="mx-auto grid w-full max-w-5xl overflow-hidden rounded-3xl border border-line bg-surface shadow-lifted lg:grid-cols-[0.9fr_1.1fr]"
  >
    <aside
      aria-label="Account benefits"
      class="relative overflow-hidden bg-brand-strong px-6 py-8 text-white sm:px-8 lg:flex lg:flex-col lg:justify-between lg:p-10"
    >
      <div
        class="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full border-[42px] border-white/5"
        aria-hidden="true"
      />
      <div class="relative">
        <div aria-label="Virelio brand" class="flex items-center gap-3">
          <span
            class="flex size-10 items-center justify-center rounded-xl bg-surface shadow-lg shadow-black/15"
          >
            <img src="/logo-mark.svg" alt="" class="size-10" />
          </span>
          <span>
            <span class="block text-[10px] font-semibold uppercase tracking-[0.24em] text-white/45">
              Expense tracker
            </span>
            <span class="mt-0.5 block text-xl font-semibold tracking-tight text-white"
              >Virelio</span
            >
          </span>
        </div>
        <p class="mt-8 text-xs font-semibold uppercase tracking-[0.24em] text-white/45">
          Your financial workspace
        </p>
        <h1 class="mt-3 max-w-md text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
          Keep every expense in context.
        </h1>
        <p class="mt-4 max-w-md text-sm leading-6 text-white/60 sm:text-base">
          Return to a clear view of purchases, recurring costs, vendors, and spending trends.
        </p>
      </div>

      <ul class="relative mt-8 space-y-3 text-sm text-white/70 lg:mt-12">
        <li class="flex items-center gap-3">
          <CheckCircle2 :size="17" class="text-accent-soft" aria-hidden="true" />
          Private account-based workspace
        </li>
        <li class="flex items-center gap-3">
          <CheckCircle2 :size="17" class="text-accent-soft" aria-hidden="true" />
          Reports that keep the details close
        </li>
      </ul>
    </aside>

    <div class="px-6 py-8 sm:p-10 lg:p-12">
      <header>
        <p class="text-xs font-semibold uppercase tracking-[0.22em] text-accent">Welcome back</p>
        <h2 class="mt-2 text-3xl font-semibold tracking-tight text-ink">Sign in to Virelio</h2>
        <p class="mt-2 text-sm leading-6 text-ink-muted">
          Enter your details to continue to your workspace.
        </p>
      </header>

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
            class="min-h-11 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition placeholder:text-stone-400 hover:border-stone-300 focus:border-brand"
          />
          <p v-if="formErrors.email" id="login-email-error" class="text-sm text-red-600">
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
              class="min-h-11 w-full rounded-xl border border-line bg-white px-3 py-2 pr-12 text-sm text-ink outline-none transition hover:border-stone-300 focus:border-brand"
            />
            <button
              type="button"
              class="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-ink-muted transition hover:text-ink"
              :aria-label="showPassword ? 'Hide password' : 'Show password'"
              @click="showPassword = !showPassword"
            >
              <EyeOff v-if="showPassword" :size="18" aria-hidden="true" />
              <Eye v-else :size="18" aria-hidden="true" />
            </button>
          </div>
          <p v-if="formErrors.password" id="login-password-error" class="text-sm text-red-600">
            {{ formErrors.password }}
          </p>
        </div>

        <div
          v-if="submitError"
          role="alert"
          class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {{ submitError }}
        </div>

        <button
          type="submit"
          :disabled="submitting"
          class="group inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-white transition hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-60"
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

      <p class="mt-7 border-t border-line pt-5 text-center text-sm text-ink-muted">
        New to Virelio?
        <RouterLink to="/register" class="font-semibold text-brand hover:text-brand-strong">
          Create an account
        </RouterLink>
      </p>
    </div>
  </section>
</template>
