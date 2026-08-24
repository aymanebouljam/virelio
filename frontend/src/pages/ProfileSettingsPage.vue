<script setup lang="ts">
import { computed, ref } from 'vue'
import { ZodError } from 'zod'
import { Check, Clock3, Save } from '@lucide/vue'
import LedgerSurface from '@/components/ui/LedgerSurface.vue'
import WorkspaceHeader from '@/components/ui/WorkspaceHeader.vue'
import { ApiError } from '@/lib/api'
import { updateProfile } from '@/lib/auth/api'
import { profileFormSchema, type ProfileFormValues } from '@/lib/auth/schema'
import { currentUser } from '@/lib/auth/storage'
import { formatDateTime, formatRelativeDate, getInitials } from '@/lib/helpers'
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
const profileInitials = computed(() =>
  getInitials(currentUser.value?.fullName ?? form.value.fullName),
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
  <section class="min-w-0 space-y-6">
    <WorkspaceHeader
      context="Account"
      title="Profile settings"
      description="Update the details used across your workspace."
    />

    <div class="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
      <LedgerSurface aria-label="Profile settings form" data-profile-record class="overflow-hidden">
        <form aria-label="Profile settings form" @submit.prevent="submit">
          <header class="flex min-w-0 items-center gap-3 border-b border-line px-5 py-4 sm:px-6">
            <span
              data-profile-initials
              class="font-figure flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-base font-semibold tracking-[0.04em] text-white shadow-card"
              aria-hidden="true"
            >
              {{ profileInitials }}
            </span>
            <div class="min-w-0">
              <h2
                class="font-display break-words text-lg font-semibold tracking-[-0.02em] text-ink"
              >
                Identity details
              </h2>
              <p class="text-xs leading-5 text-ink-muted">
                Used to identify you throughout your workspace.
              </p>
            </div>
          </header>

          <div class="space-y-5 p-5 sm:p-6">
            <div class="space-y-1.5">
              <label for="profile-full-name" class="text-sm font-medium text-ink">Full name</label>
              <input
                id="profile-full-name"
                v-model="form.fullName"
                name="fullName"
                type="text"
                autocomplete="name"
                maxlength="120"
                :aria-describedby="formErrors.fullName ? 'profile-full-name-error' : undefined"
                :aria-invalid="Boolean(formErrors.fullName)"
                :class="[
                  'min-h-11 w-full rounded-lg border bg-surface-raised px-3 py-2 text-sm text-ink outline-none transition hover:border-line-strong focus:bg-surface',
                  formErrors.fullName
                    ? 'border-danger focus:border-danger'
                    : 'border-line focus:border-brand',
                ]"
              />
              <p
                v-if="formErrors.fullName"
                id="profile-full-name-error"
                class="text-sm text-danger"
              >
                {{ formErrors.fullName }}
              </p>
            </div>

            <div class="space-y-1.5">
              <label for="profile-email" class="text-sm font-medium text-ink">Email address</label>
              <input
                id="profile-email"
                v-model="form.email"
                name="email"
                type="email"
                autocomplete="email"
                maxlength="254"
                :aria-describedby="formErrors.email ? 'profile-email-error' : undefined"
                :aria-invalid="Boolean(formErrors.email)"
                :class="[
                  'min-h-11 w-full rounded-lg border bg-surface-raised px-3 py-2 text-sm text-ink outline-none transition hover:border-line-strong focus:bg-surface',
                  formErrors.email
                    ? 'border-danger focus:border-danger'
                    : 'border-line focus:border-brand',
                ]"
              />
              <p v-if="formErrors.email" id="profile-email-error" class="text-sm text-danger">
                {{ formErrors.email }}
              </p>
            </div>

            <p
              v-if="submitError"
              role="alert"
              class="rounded-lg border border-danger/25 bg-danger-soft px-4 py-3 text-sm text-danger"
            >
              {{ submitError }}
            </p>
            <p
              v-if="successMessage"
              role="status"
              class="flex items-center gap-2 rounded-lg border border-success/25 bg-success-soft px-4 py-3 text-sm text-success"
            >
              <Check :size="16" aria-hidden="true" />
              {{ successMessage }}
            </p>
          </div>

          <footer
            class="flex flex-col gap-2 border-t border-line bg-surface-raised px-5 py-4 sm:flex-row sm:justify-end sm:px-6"
          >
            <button
              type="submit"
              :disabled="submitting || unchanged"
              class="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg bg-brand px-4 text-sm font-semibold text-white transition hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-45 sm:min-h-10 sm:w-auto"
            >
              <Save :size="15" aria-hidden="true" />
              {{ submitting ? 'Saving...' : 'Save changes' }}
            </button>
          </footer>
        </form>
      </LedgerSurface>

      <LedgerSurface v-if="currentUser" tone="quiet" class="relative overflow-hidden p-5 sm:p-6">
        <span class="absolute inset-y-0 left-0 w-1 bg-accent" aria-hidden="true" />
        <header class="min-w-0 border-b border-line pb-5">
          <p class="text-xs font-semibold tracking-[0.08em] text-evidence">Account</p>
          <h2
            class="font-display mt-1 break-words text-lg font-semibold tracking-[-0.02em] text-ink"
          >
            Account history
          </h2>
        </header>

        <dl class="divide-y divide-line text-sm">
          <div class="relative min-w-0 py-4">
            <dt class="text-xs font-medium text-ink-muted">Current identity</dt>
            <dd class="mt-2 break-words text-sm font-semibold text-ink">
              {{ currentUser.fullName }}
            </dd>
            <dd class="mt-1 break-words text-sm text-ink-muted">{{ currentUser.email }}</dd>
            <dd class="absolute right-0 top-4">
              <span
                class="inline-flex border-l-2 border-success pl-2 text-xs font-semibold text-success"
              >
                Active account
              </span>
            </dd>
          </div>
          <div class="py-4">
            <dt class="flex items-center gap-2 text-xs font-medium text-ink-muted">
              <Clock3 :size="14" aria-hidden="true" />
              Member since
            </dt>
            <dd class="font-figure mt-1.5 text-ink">
              <time
                :datetime="currentUser.createdAt"
                :title="formatDateTime(currentUser.createdAt)"
              >
                {{ formatRelativeDate(currentUser.createdAt) }}
              </time>
            </dd>
          </div>
          <div class="pb-0 pt-4">
            <dt class="flex items-center gap-2 text-xs font-medium text-ink-muted">
              <Clock3 :size="14" aria-hidden="true" />
              Last updated
            </dt>
            <dd class="font-figure mt-1.5 text-ink">
              <time
                :datetime="currentUser.updatedAt"
                :title="formatDateTime(currentUser.updatedAt)"
              >
                {{ formatRelativeDate(currentUser.updatedAt) }}
              </time>
            </dd>
          </div>
        </dl>
      </LedgerSurface>
    </div>
  </section>
</template>
