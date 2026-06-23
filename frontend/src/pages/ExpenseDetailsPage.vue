<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ApiError } from '@/lib/api'
import { fetchExpense } from '@/lib/expenses/api'
import { expenseDetailSchema, type ExpenseDetail } from '@/lib/expenses/schema'
import { removeExpenseProof, uploadExpenseProof } from '@/lib/proofs/api'

const route = useRoute()
const router = useRouter()

const expense = ref<ExpenseDetail | null>(null)
const loading = ref(true)
const error = ref('')

const expenseId = computed(() => String(route.params.id ?? ''))
const removingProofId = ref<string | null>(null)

const uploadError = ref('')
const proofActionError = ref('')
const uploading = ref(false)

function formatDate(value: string) {
  return new Date(value).toLocaleDateString()
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString()
}

function formatAmount(value: string) {
  const amount = Number(value)
  return Number.isNaN(amount) ? 'N/A' : amount.toFixed(2)
}

function formatFileSize(sizeBytes: number) {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`
  }

  const sizeKb = sizeBytes / 1024
  if (sizeKb < 1024) {
    return `${sizeKb.toFixed(1)} KB`
  }

  const sizeMb = sizeKb / 1024
  return `${sizeMb.toFixed(1)} MB`
}

async function loadExpense() {
  try {
    error.value = ''

    const result = expenseDetailSchema.safeParse(await fetchExpense(expenseId.value))

    if (!result.success) {
      error.value = 'Failed to validate expense details'
      return
    }

    expense.value = result.data
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Something went wrong'
  } finally {
    loading.value = false
  }
}

function goBack() {
  void router.push('/expenses')
}

async function onProofSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]

  if (!file || !expense.value) {
    return
  }

  uploadError.value = ''
  uploading.value = true

  try {
    const proof = await uploadExpenseProof(expense.value.id, file)
    expense.value = {
      ...expense.value,
      proofs: [...expense.value.proofs, proof],
    }
  } catch (err) {
    uploadError.value = err instanceof ApiError ? err.message : 'Uploading proof failed'
  } finally {
    uploading.value = false
    input.value = ''
  }
}

async function removeProof(proofId: string) {
  if (!expense.value) {
    return
  }

  if (!confirm('Are you sure you want to remove this proof document?')) {
    return
  }

  proofActionError.value = ''
  removingProofId.value = proofId

  try {
    await removeExpenseProof(expense.value.id, proofId)
    expense.value = {
      ...expense.value,
      proofs: expense.value.proofs.filter((proof) => proof.id !== proofId),
    }
  } catch (err) {
    proofActionError.value = err instanceof ApiError ? err.message : 'Removing proof failed'
  } finally {
    removingProofId.value = null
  }
}

function getProofUrl(storagePath: string): string {
  const baseUrl = import.meta.env.VITE_API_BASE_URL

  if (!baseUrl) {
    throw new Error('VITE_API_BASE_URL is not defined')
  }

  return `${baseUrl.replace(/\/$/, '')}/${storagePath.replace(/^\/+/, '')}`
}
onMounted(loadExpense)
</script>

<template>
  <section class="space-y-8">
    <header class="space-y-4">
      <button
        type="button"
        class="inline-flex items-center rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-600 transition hover:border-stone-300 hover:text-stone-900"
        @click="goBack"
      >
        Back
      </button>

      <div>
        <p class="text-xs font-semibold uppercase tracking-[0.24em] text-stone-400">
          Expense details
        </p>
        <h2 class="mt-2 text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">
          {{ expense?.description ?? 'Expense' }}
        </h2>
      </div>
    </header>

    <section v-if="loading" class="space-y-3">
      <div class="h-8 w-56 animate-pulse rounded bg-stone-200"></div>
      <div class="grid gap-4 lg:grid-cols-2">
        <div class="h-48 animate-pulse rounded-3xl bg-stone-100"></div>
        <div class="h-48 animate-pulse rounded-3xl bg-stone-100"></div>
      </div>
    </section>

    <section
      v-else-if="error"
      class="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700"
    >
      <p class="font-medium">Could not load expense</p>
      <p class="mt-1">{{ error }}</p>
    </section>

    <template v-else-if="expense">
      <section class="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,1fr)]">
        <article class="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
          <div class="flex items-start justify-between gap-4">
            <div>
              <p class="text-sm text-stone-500">Recorded amount</p>
              <p class="mt-2 text-3xl font-semibold tracking-tight text-stone-900">
                {{ formatAmount(expense.amount) }}
              </p>
            </div>

            <span
              class="inline-flex items-center rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-600 ring-1 ring-stone-200"
            >
              {{ expense.category?.name ?? 'No category' }}
            </span>
          </div>

          <dl class="mt-8 grid gap-5 sm:grid-cols-2">
            <div>
              <dt class="text-sm font-medium text-stone-500">Expense date</dt>
              <dd class="mt-1 text-sm text-stone-900">
                {{ formatDate(expense.expenseDate) }}
              </dd>
            </div>

            <div>
              <dt class="text-sm font-medium text-stone-500">Created</dt>
              <dd class="mt-1 text-sm text-stone-900">
                {{ formatDateTime(expense.createdAt) }}
              </dd>
            </div>

            <div>
              <dt class="text-sm font-medium text-stone-500">Updated</dt>
              <dd class="mt-1 text-sm text-stone-900">
                {{ formatDateTime(expense.updatedAt) }}
              </dd>
            </div>

            <div>
              <dt class="text-sm font-medium text-stone-500">Status</dt>
              <dd class="mt-1 text-sm text-stone-900">
                {{ expense.archivedAt ? 'Archived' : 'Active' }}
              </dd>
            </div>
          </dl>

          <div v-if="expense.notes" class="mt-8 border-t border-stone-200 pt-6">
            <p class="text-sm font-medium text-stone-500">Notes</p>
            <p class="mt-2 whitespace-pre-wrap text-sm leading-6 text-stone-700">
              {{ expense.notes }}
            </p>
          </div>
        </article>

        <div class="space-y-4">
          <article class="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
            <p class="text-sm font-medium text-stone-500">Vendor</p>
            <h3 class="mt-2 text-xl font-semibold tracking-tight text-stone-900">
              {{ expense.vendor.name }}
            </h3>

            <dl class="mt-5 space-y-3 text-sm">
              <div v-if="expense.vendor.email" class="flex flex-col gap-1">
                <dt class="text-stone-500">Email</dt>
                <dd class="text-stone-900">{{ expense.vendor.email }}</dd>
              </div>

              <div v-if="expense.vendor.phone" class="flex flex-col gap-1">
                <dt class="text-stone-500">Phone</dt>
                <dd class="text-stone-900">{{ expense.vendor.phone }}</dd>
              </div>

              <div v-if="expense.vendor.website" class="flex flex-col gap-1">
                <dt class="text-stone-500">Website</dt>
                <dd class="text-stone-900">{{ expense.vendor.website }}</dd>
              </div>

              <div v-if="expense.vendor.notes" class="flex flex-col gap-1">
                <dt class="text-stone-500">Notes</dt>
                <dd class="text-stone-900">{{ expense.vendor.notes }}</dd>
              </div>
            </dl>
          </article>

          <article class="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
            <p class="text-sm font-medium text-stone-500">Category</p>
            <template v-if="expense.category">
              <div class="mt-3 flex items-center gap-3">
                <span
                  class="h-4 w-4 rounded-full ring-1 ring-black/5"
                  :style="{ backgroundColor: expense.category.color ?? '#94a3b8' }"
                />
                <h3 class="text-xl font-semibold tracking-tight text-stone-900">
                  {{ expense.category.name }}
                </h3>
              </div>

              <p class="mt-4 text-sm text-stone-500">
                {{ expense.category.color ?? 'No color set' }}
              </p>
            </template>

            <p v-else class="mt-3 text-sm text-stone-500">No category assigned.</p>
          </article>

          <article class="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
            <p class="text-sm font-medium text-stone-500">Proof documents</p>

            <div class="mt-4 flex flex-col gap-3">
              <label
                class="inline-flex w-fit cursor-pointer items-center rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-600 transition hover:border-stone-300 hover:text-stone-900"
              >
                <input
                  type="file"
                  class="hidden"
                  :disabled="uploading || removingProofId !== null"
                  @change="onProofSelected"
                />
                {{ uploading ? 'Uploading...' : 'Upload proof' }}
              </label>

              <div
                v-if="uploadError"
                class="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {{ uploadError }}
              </div>
            </div>

            <div
              v-if="proofActionError"
              class="mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {{ proofActionError }}
            </div>

            <div v-if="expense.proofs.length === 0" class="mt-3 text-sm text-stone-500">
              No proof documents attached.
            </div>

            <ul v-else class="mt-4 space-y-3">
              <li
                v-for="proof in expense.proofs"
                :key="proof.id"
                class="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3"
              >
                <a
                  :href="getProofUrl(proof.storagePath)"
                  target="_blank"
                  rel="noreferrer"
                  class="text-sm font-medium text-stone-900 underline decoration-stone-300 underline-offset-4 transition hover:text-stone-700"
                >
                  {{ proof.originalName }}
                </a>

                <div class="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-500">
                  <span>{{ proof.mimeType }}</span>
                  <span>{{ formatFileSize(proof.sizeBytes) }}</span>

                  <span>{{ formatDateTime(proof.createdAt) }}</span>
                </div>
                <div class="mt-3">
                  <button
                    type="button"
                    class="inline-flex items-center rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-600 transition hover:border-stone-300 hover:text-stone-900 disabled:cursor-not-allowed disabled:opacity-60"
                    :disabled="removingProofId === proof.id"
                    @click="removeProof(proof.id)"
                  >
                    {{ removingProofId === proof.id ? 'Removing...' : 'Remove' }}
                  </button>
                </div>
              </li>
            </ul>
          </article>
        </div>
      </section>
    </template>
  </section>
</template>
