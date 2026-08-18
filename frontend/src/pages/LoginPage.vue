<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
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
  <section class="mx-auto w-full max-w-md">
    <div class="w-full rounded-3xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
      <header class="space-y-2">
        <p class="text-xs font-semibold uppercase tracking-[0.24em] text-stone-400">Welcome back</p>
        <h1 class="text-3xl font-semibold tracking-tight text-stone-900">Sign in to Virelio</h1>
        <p class="text-sm leading-6 text-stone-500">
          Continue managing expenses, vendors, and proof documents.
        </p>
      </header>

      <form aria-label="Login form" class="mt-6 space-y-4" @submit.prevent="submit">
        <div class="space-y-2">
          <label for="login-email" class="text-sm font-medium text-stone-700">Email</label>
          <input
            id="login-email"
            v-model="form.email"
            type="email"
            autocomplete="email"
            :aria-describedby="formErrors.email ? 'login-email-error' : undefined"
            :aria-invalid="Boolean(formErrors.email)"
            class="min-h-11 w-full rounded-2xl border border-stone-200 px-3 py-2 text-sm text-stone-900 outline-none transition focus:border-stone-400"
          />
          <p v-if="formErrors.email" id="login-email-error" class="text-sm text-red-600">
            {{ formErrors.email }}
          </p>
        </div>

        <div class="space-y-2">
          <label for="login-password" class="text-sm font-medium text-stone-700">Password</label>
          <input
            id="login-password"
            v-model="form.password"
            type="password"
            autocomplete="current-password"
            :aria-describedby="formErrors.password ? 'login-password-error' : undefined"
            :aria-invalid="Boolean(formErrors.password)"
            class="min-h-11 w-full rounded-2xl border border-stone-200 px-3 py-2 text-sm text-stone-900 outline-none transition focus:border-stone-400"
          />
          <p v-if="formErrors.password" id="login-password-error" class="text-sm text-red-600">
            {{ formErrors.password }}
          </p>
        </div>

        <div
          v-if="submitError"
          role="alert"
          class="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {{ submitError }}
        </div>

        <button
          type="submit"
          :disabled="submitting"
          class="inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {{ submitting ? 'Signing in...' : 'Sign in' }}
        </button>
      </form>

      <p class="mt-6 text-center text-sm text-stone-500">
        New to Virelio?
        <RouterLink to="/register" class="font-semibold text-stone-900 hover:underline">
          Create an account
        </RouterLink>
      </p>
    </div>
  </section>
</template>
