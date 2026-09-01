<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ZodError } from 'zod'
import { ApiError } from '@/lib/api'
import { confirmEmailVerification } from '@/lib/auth/api'
import { emailVerificationConfirmFormSchema } from '@/lib/auth/schema'
import { currentUser, isAuthenticated } from '@/lib/auth/storage'

const route = useRoute()
const token = typeof route.query.token === 'string' ? route.query.token : ''
const status = ref<'verifying' | 'success' | 'error'>('verifying')
const message = ref('')

function normalizeError(err: unknown) {
  if (err instanceof ApiError) {
    return err.message
  }

  if (err instanceof ZodError) {
    return err.issues[0]?.message ?? 'This verification link is invalid'
  }

  return 'Something went wrong while verifying your email'
}

async function verifyEmail() {
  try {
    const input = emailVerificationConfirmFormSchema.parse({ token })
    const response = await confirmEmailVerification(input)
    if (currentUser.value) {
      currentUser.value = {
        ...currentUser.value,
        emailVerifiedAt: new Date().toISOString(),
      }
    }
    status.value = 'success'
    message.value = response.message
  } catch (err) {
    status.value = 'error'
    message.value = normalizeError(err)
  }
}

onMounted(verifyEmail)
</script>

<template>
  <section
    class="mx-auto w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-lifted sm:p-8"
  >
    <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
      Email verification
    </p>
    <h1 class="font-display mt-2 text-2xl font-semibold tracking-tight text-ink">
      {{ status === 'verifying' ? 'Verifying your email' : 'Email verification' }}
    </h1>
    <div class="mt-6 space-y-4">
      <p v-if="status === 'verifying'" role="status" class="text-sm text-ink-muted">
        Verifying your email address...
      </p>

      <template v-else-if="status === 'success'">
        <p
          role="status"
          class="rounded-lg border border-success/25 bg-success-soft px-4 py-3 text-sm text-success"
        >
          {{ message }}
        </p>

        <RouterLink
          :to="isAuthenticated ? '/' : '/login'"
          class="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-brand px-4 text-sm font-semibold text-white transition hover:bg-brand-strong"
        >
          {{ isAuthenticated ? 'Return to dashboard' : 'Go to sign in' }}
        </RouterLink>
      </template>

      <template v-else>
        <p
          role="alert"
          class="rounded-lg border border-danger/25 bg-danger-soft px-4 py-3 text-sm text-danger"
        >
          {{ message }}
        </p>

        <RouterLink
          to="/resend-verification"
          class="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-brand px-4 text-sm font-semibold text-white transition hover:bg-brand-strong"
        >
          Resend verification email
        </RouterLink>
      </template>
    </div>
  </section>
</template>
