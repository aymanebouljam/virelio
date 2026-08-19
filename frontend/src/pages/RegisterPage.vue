<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowRight, CheckCircle2, Eye, EyeOff } from '@lucide/vue'
import { ApiError } from '@/lib/api'
import { register as registerUser } from '@/lib/auth/api'
import { registerFormSchema, type RegisterFormValues } from '@/lib/auth/schema'
import { ZodError } from 'zod'
import { mapZodErrors } from '@/lib/zod'

const router = useRouter()

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
    await registerUser(form.value)
    resetForm()
    await router.push('/login')
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
          Start with clarity
        </p>
        <h1 class="mt-3 max-w-md text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
          Build a better expense routine.
        </h1>
        <p class="mt-4 max-w-md text-sm leading-6 text-white/60 sm:text-base">
          Create one focused workspace for daily expenses, repeat costs, proofs, and reports.
        </p>
      </div>

      <ul class="relative mt-8 space-y-3 text-sm text-white/70 lg:mt-12">
        <li class="flex items-center gap-3">
          <CheckCircle2 :size="17" class="text-accent-soft" aria-hidden="true" />
          Structured expense and vendor records
        </li>
        <li class="flex items-center gap-3">
          <CheckCircle2 :size="17" class="text-accent-soft" aria-hidden="true" />
          Recurring schedules and readable reports
        </li>
      </ul>
    </aside>

    <div class="px-6 py-8 sm:p-10 lg:p-12">
      <header>
        <p class="text-xs font-semibold uppercase tracking-[0.22em] text-accent">Get started</p>
        <h2 class="mt-2 text-3xl font-semibold tracking-tight text-ink">Create your account</h2>
        <p class="mt-2 text-sm leading-6 text-ink-muted">
          Set up your private Virelio workspace in a moment.
        </p>
      </header>

      <form aria-label="Registration form" class="mt-7 space-y-4" @submit.prevent="submit">
        <div class="space-y-1.5">
          <label for="register-full-name" class="text-sm font-medium text-ink"> Full name </label>
          <input
            id="register-full-name"
            v-model="form.fullName"
            type="text"
            autocomplete="name"
            placeholder="Your name"
            :aria-describedby="formErrors.fullName ? 'register-full-name-error' : undefined"
            :aria-invalid="Boolean(formErrors.fullName)"
            class="min-h-11 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition placeholder:text-stone-400 hover:border-stone-300 focus:border-brand"
          />
          <p v-if="formErrors.fullName" id="register-full-name-error" class="text-sm text-red-600">
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
            class="min-h-11 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition placeholder:text-stone-400 hover:border-stone-300 focus:border-brand"
          />
          <p v-if="formErrors.email" id="register-email-error" class="text-sm text-red-600">
            {{ formErrors.email }}
          </p>
        </div>

        <div class="space-y-1.5">
          <label for="register-password" class="text-sm font-medium text-ink"> Password </label>
          <div class="relative">
            <input
              id="register-password"
              v-model="form.password"
              :type="showPasswords ? 'text' : 'password'"
              autocomplete="new-password"
              :aria-describedby="formErrors.password ? 'register-password-error' : undefined"
              :aria-invalid="Boolean(formErrors.password)"
              class="min-h-11 w-full rounded-xl border border-line bg-white px-3 py-2 pr-12 text-sm text-ink outline-none transition hover:border-stone-300 focus:border-brand"
            />
            <button
              type="button"
              class="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-ink-muted transition hover:text-ink"
              :aria-label="showPasswords ? 'Hide passwords' : 'Show passwords'"
              @click="showPasswords = !showPasswords"
            >
              <EyeOff v-if="showPasswords" :size="18" aria-hidden="true" />
              <Eye v-else :size="18" aria-hidden="true" />
            </button>
          </div>
          <p v-if="formErrors.password" id="register-password-error" class="text-sm text-red-600">
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
            class="min-h-11 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition hover:border-stone-300 focus:border-brand"
          />
          <p
            v-if="formErrors.passwordConfirmation"
            id="register-password-confirmation-error"
            class="text-sm text-red-600"
          >
            {{ formErrors.passwordConfirmation }}
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
          {{ submitting ? 'Creating account...' : 'Create account' }}
          <ArrowRight
            v-if="!submitting"
            :size="16"
            class="transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </button>
      </form>

      <p class="mt-7 border-t border-line pt-5 text-center text-sm text-ink-muted">
        Already have an account?
        <RouterLink to="/login" class="font-semibold text-brand hover:text-brand-strong">
          Sign in
        </RouterLink>
      </p>
    </div>
  </section>
</template>
