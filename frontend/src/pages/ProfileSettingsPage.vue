<script setup lang="ts">
import { computed, ref } from 'vue'
import { ZodError } from 'zod'
import { ApiError } from '@/lib/api'
import { updateProfile } from '@/lib/auth/api'
import { profileFormSchema, type ProfileFormValues } from '@/lib/auth/schema'
import { currentUser } from '@/lib/auth/storage'
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
const unchanged = computed(
  () =>
    form.value.fullName === baseline.value.fullName && form.value.email === baseline.value.email,
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
</script>

<template>
  <section class="mx-auto w-full max-w-2xl space-y-8">
    <header class="space-y-2">
      <p class="text-xs font-semibold uppercase tracking-[0.24em] text-stone-400">Account</p>
      <h1 class="text-3xl font-semibold tracking-tight text-stone-900">Profile settings</h1>
      <p class="text-sm leading-6 text-stone-500">
        Update the name and email address associated with your account.
      </p>
    </header>

    <form
      aria-label="Profile settings form"
      class="space-y-5 rounded-3xl border border-stone-200 bg-white p-6 shadow-sm"
      @submit.prevent="submit"
    >
      <div class="space-y-2">
        <label for="profile-full-name" class="text-sm font-medium text-stone-700">Full name</label>
        <input
          id="profile-full-name"
          v-model="form.fullName"
          type="text"
          maxlength="120"
          class="min-h-11 w-full rounded-2xl border border-stone-200 px-3 py-2 text-sm text-stone-900 outline-none transition focus:border-stone-400"
        />
        <p v-if="formErrors.fullName" class="text-sm text-red-600">{{ formErrors.fullName }}</p>
      </div>

      <div class="space-y-2">
        <label for="profile-email" class="text-sm font-medium text-stone-700">Email</label>
        <input
          id="profile-email"
          v-model="form.email"
          type="email"
          maxlength="254"
          class="min-h-11 w-full rounded-2xl border border-stone-200 px-3 py-2 text-sm text-stone-900 outline-none transition focus:border-stone-400"
        />
        <p v-if="formErrors.email" class="text-sm text-red-600">{{ formErrors.email }}</p>
      </div>

      <p
        v-if="submitError"
        class="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
      >
        {{ submitError }}
      </p>
      <p
        v-if="successMessage"
        role="status"
        class="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
      >
        {{ successMessage }}
      </p>

      <div class="flex justify-end">
        <button
          type="submit"
          :disabled="submitting || unchanged"
          class="inline-flex min-h-11 items-center justify-center rounded-2xl bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {{ submitting ? 'Saving...' : 'Save changes' }}
        </button>
      </div>
    </form>
  </section>
</template>
