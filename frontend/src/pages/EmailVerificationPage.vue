<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ZodError } from 'zod'
import AuthFrame from '@/components/auth/AuthFrame.vue'
import { ApiError } from '@/lib/api'
import { confirmEmailVerification } from '@/lib/auth/api'
import { emailVerificationConfirmFormSchema } from '@/lib/auth/schema'
import { currentUser, isAuthenticated } from '@/lib/auth/storage'

const route = useRoute()
const token = typeof route.query.token === 'string' ? route.query.token : ''
const status = ref<'verifying' | 'success' | 'error'>('verifying')
const message = ref('')

const accountBenefits = [
  'Your email confirms access to your workspace',
  'Verification links can only be used once',
  'Your expense record stays private to you',
]

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
    status.value = 'success'
    message.value = response.message
    if (currentUser.value) {
      currentUser.value = {
        ...currentUser.value,
        emailVerifiedAt: new Date().toISOString(),
      }
    }
  } catch (err) {
    status.value = 'error'
    message.value = normalizeError(err)
  }
}

onMounted(verifyEmail)
</script>

<template>
  <AuthFrame
    panel-eyebrow="Secure your workspace"
    panel-title="Confirm the email connected to your record."
    panel-description="Email verification helps keep your workspace and expense history available only to you."
    :benefits="accountBenefits"
    form-eyebrow="Email verification"
    form-title="Verifying your email"
    form-description="We're confirming your verification link now."
  >
    <div class="mt-7 space-y-5">
      <p v-if="status === 'verifying'" role="status" class="text-sm text-ink-muted">
        Verifying your email address...
      </p>

      <template v-else-if="status === 'success'">
        <p
          role="status"
          class="rounded-lg border border-success/25 bg-success-soft px-4 py-3 text-sm text-success"
        >
          {{ message }}
          {{ isAuthenticated ? 'Your email address is confirmed.' : 'You can now sign in.' }}
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
  </AuthFrame>
</template>
