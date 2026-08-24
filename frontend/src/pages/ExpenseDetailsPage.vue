<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Download, EllipsisVertical, FileText, Trash2, Upload } from '@lucide/vue'
import RecordActionSheet, { type RecordActionItem } from '@/components/ui/RecordActionSheet.vue'
import { ApiError } from '@/lib/api'
import { fetchExpense } from '@/lib/expenses/api'
import { expenseDetailSchema, type ExpenseDetail } from '@/lib/expenses/schema'
import { formatAmount, formatDate, formatDateTime, formatFileSize } from '@/lib/helpers'
import { downloadExpenseProof, removeExpenseProof, uploadExpenseProof } from '@/lib/proofs/api'
import type { ProofDocument } from '@/lib/proofs/api'

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

const downloadingProofId = ref<string | null>(null)
const mobileActionsOpen = ref(false)
const activeActionProof = ref<ProofDocument | null>(null)

const mobileProofActions = [
  { id: 'download', label: 'Download proof', icon: Download },
  { id: 'remove', label: 'Remove proof', icon: Trash2, tone: 'danger' },
] as const satisfies readonly RecordActionItem[]

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
  router.back()
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

async function downloadProof(proofId: string, originalName: string) {
  if (!expense.value) {
    return
  }

  proofActionError.value = ''
  downloadingProofId.value = proofId

  try {
    const blob = await downloadExpenseProof(expense.value.id, proofId)
    const objectUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = objectUrl
    link.download = originalName
    link.click()

    URL.revokeObjectURL(objectUrl)
  } catch (err) {
    proofActionError.value = err instanceof ApiError ? err.message : 'Downloading proof failed'
  } finally {
    downloadingProofId.value = null
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

function openMobileProofActions(proof: ProofDocument) {
  activeActionProof.value = proof
  mobileActionsOpen.value = true
}

function handleMobileProofAction(actionId: string) {
  const proof = activeActionProof.value
  if (!proof) return

  mobileActionsOpen.value = false
  activeActionProof.value = null

  if (actionId === 'download') {
    void downloadProof(proof.id, proof.originalName)
  } else if (actionId === 'remove') {
    void removeProof(proof.id)
  }
}

onMounted(loadExpense)
</script>

<template>
  <section class="min-w-0 space-y-6">
    <header class="space-y-5 border-b border-line pb-6">
      <button
        type="button"
        class="inline-flex min-h-10 items-center gap-2 rounded-lg border border-line bg-surface px-3 text-sm font-medium text-ink-muted transition hover:border-line-strong hover:text-ink"
        @click="goBack"
      >
        <ArrowLeft :size="15" aria-hidden="true" />
        Back
      </button>

      <div>
        <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
          Expense record
        </p>
        <h1
          class="font-display mt-2 text-[2rem] font-semibold leading-tight tracking-[-0.035em] text-ink sm:text-[2.5rem]"
        >
          {{ expense?.description ?? 'Expense' }}
        </h1>
      </div>
    </header>

    <section v-if="loading" class="space-y-3" role="status" aria-label="Loading expense details">
      <div class="h-8 w-56 animate-pulse rounded bg-surface-muted"></div>
      <div class="grid gap-4 lg:grid-cols-2">
        <div class="h-48 animate-pulse rounded-xl bg-surface-muted/70"></div>
        <div class="h-48 animate-pulse rounded-xl bg-surface-muted/70"></div>
      </div>
    </section>

    <section
      v-else-if="error"
      role="alert"
      class="rounded-xl border border-danger/25 bg-danger-soft px-5 py-4 text-sm text-danger"
    >
      <p class="font-medium">Could not load expense</p>
      <p class="mt-1">{{ error }}</p>
    </section>

    <template v-else-if="expense">
      <section class="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
        <article
          data-expense-record-summary
          class="relative min-w-0 overflow-hidden rounded-xl border border-line bg-surface p-5 shadow-card sm:p-6"
        >
          <span class="absolute inset-y-0 left-0 w-1 bg-accent" aria-hidden="true" />
          <div
            class="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
          >
            <div class="min-w-0">
              <p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
                Recorded amount
              </p>
              <p
                class="font-figure mt-3 text-[2rem] font-semibold tracking-[-0.04em] text-ink sm:text-[2.25rem]"
              >
                ${{ formatAmount(expense.amount) }}
              </p>
            </div>

            <span
              class="inline-flex w-fit max-w-full items-center truncate border-l-2 border-accent bg-accent-soft/60 px-2.5 py-1 text-xs font-semibold text-accent"
              :title="expense.category?.name ?? 'No category'"
            >
              {{ expense.category?.name ?? 'No category' }}
            </span>
          </div>

          <dl class="mt-8 grid border-y border-line sm:grid-cols-2">
            <div class="border-b border-line py-4 sm:border-r sm:pr-5">
              <dt class="text-xs font-medium text-ink-muted">Expense date</dt>
              <dd class="mt-1.5 text-sm font-semibold text-ink">
                {{ formatDate(expense.expenseDate) }}
              </dd>
            </div>

            <div class="border-b border-line py-4 sm:pl-5">
              <dt class="text-xs font-medium text-ink-muted">Created</dt>
              <dd class="mt-1.5 text-sm text-ink">
                {{ formatDateTime(expense.createdAt) }}
              </dd>
            </div>

            <div class="border-b border-line py-4 sm:border-b-0 sm:border-r sm:pr-5">
              <dt class="text-xs font-medium text-ink-muted">Updated</dt>
              <dd class="mt-1.5 text-sm text-ink">
                {{ formatDateTime(expense.updatedAt) }}
              </dd>
            </div>

            <div class="py-4 sm:pl-5">
              <dt class="text-xs font-medium text-ink-muted">Status</dt>
              <dd class="mt-1.5 text-sm font-semibold text-ink">
                {{ expense.archivedAt ? 'Archived' : 'Active' }}
              </dd>
            </div>
          </dl>

          <div v-if="expense.notes" class="mt-6">
            <p class="text-xs font-medium text-ink-muted">Notes</p>
            <p class="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink">
              {{ expense.notes }}
            </p>
          </div>
        </article>

        <aside class="min-w-0 rounded-xl border border-line bg-surface p-5 shadow-card sm:p-6">
          <div class="border-b border-line pb-5">
            <p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
              Record context
            </p>
            <h2 class="font-display mt-1 text-lg font-semibold tracking-[-0.02em] text-ink">
              Vendor and category
            </h2>
          </div>

          <section class="py-5">
            <p class="text-xs font-medium text-ink-muted">Vendor</p>
            <h3
              class="font-display mt-2 break-words text-xl font-semibold tracking-[-0.025em] text-ink"
            >
              {{ expense.vendor.name }}
            </h3>

            <dl class="mt-5 space-y-3 text-sm">
              <div v-if="expense.vendor.email" class="flex flex-col gap-1">
                <dt class="text-xs text-ink-muted">Email</dt>
                <dd class="break-words text-ink">{{ expense.vendor.email }}</dd>
              </div>

              <div v-if="expense.vendor.phone" class="flex flex-col gap-1">
                <dt class="text-xs text-ink-muted">Phone</dt>
                <dd class="text-ink">{{ expense.vendor.phone }}</dd>
              </div>

              <div v-if="expense.vendor.website" class="flex flex-col gap-1">
                <dt class="text-xs text-ink-muted">Website</dt>
                <dd class="break-all text-ink">{{ expense.vendor.website }}</dd>
              </div>

              <div v-if="expense.vendor.notes" class="flex flex-col gap-1">
                <dt class="text-xs text-ink-muted">Notes</dt>
                <dd class="text-ink">{{ expense.vendor.notes }}</dd>
              </div>
            </dl>
          </section>

          <section class="border-t border-line pt-5">
            <p class="text-xs font-medium text-ink-muted">Category</p>
            <template v-if="expense.category">
              <div class="mt-3 flex items-center gap-3">
                <span
                  class="h-4 w-1 rounded-sm"
                  :style="{ backgroundColor: expense.category.color ?? '#94a3b8' }"
                  aria-hidden="true"
                />
                <h3 class="text-base font-semibold text-ink">
                  {{ expense.category.name }}
                </h3>
              </div>

              <p class="font-figure mt-3 text-xs text-ink-muted">
                {{ expense.category.color ?? 'No color set' }}
              </p>
            </template>

            <p v-else class="mt-3 text-sm text-ink-muted">No category assigned.</p>
          </section>
        </aside>
      </section>

      <section class="min-w-0 overflow-hidden rounded-xl border border-line bg-surface shadow-card">
        <header
          class="flex flex-col gap-4 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"
        >
          <div>
            <p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
              Evidence trail
            </p>
            <h2 class="font-display mt-1 text-lg font-semibold tracking-[-0.02em] text-ink">
              Proof documents
            </h2>
            <p class="mt-1 text-xs text-ink-muted">
              {{ expense.proofs.length }} attached document{{
                expense.proofs.length === 1 ? '' : 's'
              }}
            </p>
          </div>

          <label
            for="expense-proof-upload"
            class="inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-line bg-surface px-3 text-sm font-semibold text-brand transition hover:border-line-strong hover:bg-surface-muted focus-within:border-brand sm:min-h-10 sm:w-fit"
          >
            <input
              id="expense-proof-upload"
              type="file"
              class="sr-only"
              :aria-describedby="uploadError ? 'expense-proof-upload-error' : undefined"
              :aria-invalid="Boolean(uploadError)"
              :disabled="uploading || removingProofId !== null || downloadingProofId !== null"
              @change="onProofSelected"
            />
            <Upload :size="15" aria-hidden="true" />
            {{ uploading ? 'Uploading...' : 'Upload proof' }}
          </label>
        </header>

        <div class="space-y-3 px-5 py-4 sm:px-6">
          <div
            v-if="uploadError"
            id="expense-proof-upload-error"
            role="alert"
            class="rounded-lg border border-danger/25 bg-danger-soft px-4 py-3 text-sm text-danger"
          >
            {{ uploadError }}
          </div>

          <div
            v-if="proofActionError"
            role="alert"
            class="rounded-lg border border-danger/25 bg-danger-soft px-4 py-3 text-sm text-danger"
          >
            {{ proofActionError }}
          </div>

          <div v-if="expense.proofs.length === 0" class="py-8 text-center">
            <span
              class="mx-auto flex size-11 items-center justify-center rounded-lg bg-accent-soft text-accent"
            >
              <FileText :size="20" aria-hidden="true" />
            </span>
            <p class="mt-3 text-sm font-semibold text-ink">No proof documents attached.</p>
            <p class="mt-1 text-sm text-ink-muted">
              Upload a receipt or invoice to support this record.
            </p>
          </div>

          <ul v-else class="divide-y divide-line border-l-2 border-l-accent/70">
            <li
              v-for="proof in expense.proofs"
              :key="proof.id"
              data-proof-record
              class="relative grid min-w-0 gap-3 py-4 pb-14 pl-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-4 sm:py-4"
            >
              <div class="flex min-w-0 items-start gap-3">
                <span
                  class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent"
                >
                  <FileText :size="17" aria-hidden="true" />
                </span>
                <div class="min-w-0">
                  <button
                    type="button"
                    class="block max-w-full truncate text-left text-sm font-semibold text-ink underline decoration-line-strong underline-offset-4 transition hover:text-brand disabled:cursor-not-allowed disabled:opacity-60"
                    :disabled="downloadingProofId === proof.id"
                    @click="downloadProof(proof.id, proof.originalName)"
                  >
                    {{ downloadingProofId === proof.id ? 'Downloading...' : proof.originalName }}
                  </button>

                  <div class="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-muted">
                    <span>{{ proof.mimeType }}</span>
                    <span>{{ formatFileSize(proof.sizeBytes) }}</span>
                    <span>{{ formatDateTime(proof.createdAt) }}</span>
                  </div>
                </div>
              </div>

              <div class="hidden items-center gap-2 sm:flex sm:justify-end">
                <button
                  type="button"
                  :aria-label="`Download ${proof.originalName}`"
                  title="Download proof"
                  class="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-brand-soft px-2.5 text-brand transition hover:bg-brand hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                  :disabled="downloadingProofId === proof.id"
                  @click="downloadProof(proof.id, proof.originalName)"
                >
                  <Download :size="17" :stroke-width="1.8" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  :aria-label="`Remove ${proof.originalName}`"
                  title="Remove proof"
                  class="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-danger-soft px-2.5 text-danger transition hover:bg-danger hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                  :disabled="removingProofId === proof.id || downloadingProofId !== null"
                  @click="removeProof(proof.id)"
                >
                  <Trash2 :size="17" :stroke-width="1.8" aria-hidden="true" />
                </button>
              </div>
              <button
                type="button"
                data-mobile-proof-actions
                class="absolute bottom-0 right-0 inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-line bg-surface px-2.5 text-ink-muted transition hover:border-line-strong hover:bg-surface-muted hover:text-ink sm:hidden"
                :aria-label="`Actions for ${proof.originalName}`"
                @click="openMobileProofActions(proof)"
              >
                <EllipsisVertical :size="18" aria-hidden="true" />
              </button>
            </li>
          </ul>
        </div>
      </section>

      <RecordActionSheet
        :open="mobileActionsOpen"
        :record-label="activeActionProof?.originalName ?? 'proof'"
        :actions="mobileProofActions"
        @update:open="mobileActionsOpen = $event"
        @select="handleMobileProofAction"
      />
    </template>
  </section>
</template>
