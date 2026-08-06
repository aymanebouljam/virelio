<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
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
  <section class="mx-auto flex min-h-[70vh] w-full max-w-md items-center">
    <div class="w-full rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
      <header class="space-y-2">
        <p class="text-xs font-semibold uppercase tracking-[0.24em] text-stone-400">Auth</p>
        <h1 class="text-2xl font-semibold tracking-tight text-stone-900">Create account</h1>
      </header>

      <form aria-label="Registration form" class="mt-6 space-y-4" @submit.prevent="submit">
        <div class="space-y-2">
          <label for="register-full-name" class="text-sm font-medium text-stone-700">
            Full name
          </label>
          <input
            id="register-full-name"
            v-model="form.fullName"
            type="text"
            autocomplete="name"
            :aria-describedby="formErrors.fullName ? 'register-full-name-error' : undefined"
            :aria-invalid="Boolean(formErrors.fullName)"
            class="min-h-11 w-full rounded-2xl border border-stone-200 px-3 py-2 text-sm text-stone-900 outline-none transition focus:border-stone-400"
          />
          <p v-if="formErrors.fullName" id="register-full-name-error" class="text-sm text-red-600">
            {{ formErrors.fullName }}
          </p>
        </div>

        <div class="space-y-2">
          <label for="register-email" class="text-sm font-medium text-stone-700">Email</label>
          <input
            id="register-email"
            v-model="form.email"
            type="email"
            autocomplete="email"
            :aria-describedby="formErrors.email ? 'register-email-error' : undefined"
            :aria-invalid="Boolean(formErrors.email)"
            class="min-h-11 w-full rounded-2xl border border-stone-200 px-3 py-2 text-sm text-stone-900 outline-none transition focus:border-stone-400"
          />
          <p v-if="formErrors.email" id="register-email-error" class="text-sm text-red-600">
            {{ formErrors.email }}
          </p>
        </div>

        <div class="space-y-2">
          <label for="register-password" class="text-sm font-medium text-stone-700">
            Password
          </label>
          <input
            id="register-password"
            v-model="form.password"
            type="password"
            autocomplete="new-password"
            :aria-describedby="formErrors.password ? 'register-password-error' : undefined"
            :aria-invalid="Boolean(formErrors.password)"
            class="min-h-11 w-full rounded-2xl border border-stone-200 px-3 py-2 text-sm text-stone-900 outline-none transition focus:border-stone-400"
          />
          <p v-if="formErrors.password" id="register-password-error" class="text-sm text-red-600">
            {{ formErrors.password }}
          </p>
        </div>

        <div class="space-y-2">
          <label for="register-password-confirmation" class="text-sm font-medium text-stone-700">
            Confirm password
          </label>
          <input
            id="register-password-confirmation"
            v-model="form.passwordConfirmation"
            type="password"
            autocomplete="new-password"
            :aria-describedby="
              formErrors.passwordConfirmation ? 'register-password-confirmation-error' : undefined
            "
            :aria-invalid="Boolean(formErrors.passwordConfirmation)"
            class="min-h-11 w-full rounded-2xl border border-stone-200 px-3 py-2 text-sm text-stone-900 outline-none transition focus:border-stone-400"
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
          class="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {{ submitError }}
        </div>

        <button
          type="submit"
          :disabled="submitting"
          class="inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {{ submitting ? 'Creating account...' : 'Create account' }}
        </button>
      </form>
    </div>
  </section>
</template>
