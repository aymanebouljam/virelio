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
    resetForm()
    await router.push('/')
  } catch (err) {
    normalizeError(err)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <section class="mx-auto flex min-h-[70vh] w-full max-w-md items-center">
    <div class="w-full rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
      <header class="space-y-2">
        <p class="text-xs font-semibold uppercase tracking-[0.24em] text-stone-400">Auth</p>
        <h1 class="text-2xl font-semibold tracking-tight text-stone-900">Sign in</h1>
      </header>

      <form class="mt-6 space-y-4" @submit.prevent="submit">
        <div class="space-y-2">
          <label class="text-sm font-medium text-stone-700">Email</label>
          <input
            v-model="form.email"
            type="email"
            class="min-h-11 w-full rounded-2xl border border-stone-200 px-3 py-2 text-sm text-stone-900 outline-none transition focus:border-stone-400"
          />
          <p v-if="formErrors.email" class="text-sm text-red-600">{{ formErrors.email }}</p>
        </div>

        <div class="space-y-2">
          <label class="text-sm font-medium text-stone-700">Password</label>
          <input
            v-model="form.password"
            type="password"
            class="min-h-11 w-full rounded-2xl border border-stone-200 px-3 py-2 text-sm text-stone-900 outline-none transition focus:border-stone-400"
          />
          <p v-if="formErrors.password" class="text-sm text-red-600">{{ formErrors.password }}</p>
        </div>

        <div
          v-if="submitError"
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
    </div>
  </section>
</template>
