<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ArchiveRestore, EllipsisVertical, ReceiptText, Trash2 } from '@lucide/vue'
import RecordActionSheet, { type RecordActionItem } from '@/components/ui/RecordActionSheet.vue'
import { ApiError } from '@/lib/api'
import { fetchExpenseCategories } from '@/lib/expense-categories/api'
import { expenseCategorySchema, type ExpenseCategory } from '@/lib/expense-categories/schema'
import { fetchArchivedExpenses, removeExpense, restoreExpense } from '@/lib/expenses/api'
import { expenseSchema, type Expense } from '@/lib/expenses/schema'
import { formatAmount, formatDate, formatDateTime } from '@/lib/helpers'
import { fetchVendors } from '@/lib/vendors/api'
import { type Vendor, vendorSchema } from '@/lib/vendors/schema'

const expenses = ref<Expense[]>([])
const vendors = ref<Vendor[]>([])
const categories = ref<ExpenseCategory[]>([])

const loading = ref(true)
const error = ref('')
const actionError = ref('')
const restoringId = ref<string | null>(null)
const removingId = ref<string | null>(null)
const mobileActionsOpen = ref(false)
const activeActionExpense = ref<Expense | null>(null)

const mobileExpenseActions = [
  { id: 'restore', label: 'Restore expense', icon: ArchiveRestore },
  { id: 'remove', label: 'Remove expense', icon: Trash2, tone: 'danger' },
] as const satisfies readonly RecordActionItem[]

const vendorNameById = computed(
  () => new Map(vendors.value.map((vendor) => [vendor.id, vendor.name])),
)

const categoryNameById = computed(
  () => new Map(categories.value.map((category) => [category.id, category.name])),
)

async function loadArchivedExpensesPage() {
  try {
    error.value = ''

    const [rawExpenses, rawVendors, rawCategories] = await Promise.all([
      fetchArchivedExpenses(),
      fetchVendors(),
      fetchExpenseCategories(),
    ])

    expenses.value = rawExpenses
      .map((expense) => expenseSchema.safeParse(expense))
      .filter((result) => result.success)
      .map((result) => result.data)

    vendors.value = rawVendors
      .map((vendor) => vendorSchema.safeParse(vendor))
      .filter((result) => result.success)
      .map((result) => result.data)

    categories.value = rawCategories
      .map((category) => expenseCategorySchema.safeParse(category))
      .filter((result) => result.success)
      .map((result) => result.data)
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Something went wrong'
  } finally {
    loading.value = false
  }
}

async function restore(expense: Expense) {
  actionError.value = ''
  restoringId.value = expense.id

  try {
    if (!confirm('Are you sure you want to restore this expense?')) {
      return
    }

    const result = expenseSchema.safeParse(await restoreExpense(expense.id))

    if (!result.success) {
      actionError.value = 'Failed to fetch restored expense'
      return
    }

    expenses.value = expenses.value.filter((item) => item.id !== result.data.id)
  } catch (err) {
    actionError.value = err instanceof ApiError ? err.message : 'Restoring expense failed'
  } finally {
    restoringId.value = null
  }
}

async function remove(expense: Expense) {
  actionError.value = ''
  removingId.value = expense.id

  try {
    if (!confirm('Are you sure you want to remove this expense?')) {
      return
    }

    await removeExpense(expense.id)
    expenses.value = expenses.value.filter((item) => item.id !== expense.id)
  } catch (err) {
    actionError.value = err instanceof ApiError ? err.message : 'Removing expense failed'
  } finally {
    removingId.value = null
  }
}

function openMobileActions(expense: Expense) {
  activeActionExpense.value = expense
  mobileActionsOpen.value = true
}

function handleMobileAction(actionId: string) {
  const expense = activeActionExpense.value
  if (!expense) return

  mobileActionsOpen.value = false
  activeActionExpense.value = null

  if (actionId === 'restore') {
    void restore(expense)
  } else if (actionId === 'remove') {
    void remove(expense)
  }
}

onMounted(loadArchivedExpensesPage)
</script>

<template>
  <section class="min-w-0 space-y-6">
    <header class="space-y-4 border-b border-line pb-6">
      <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
        Expense archive
      </p>

      <div>
        <h1
          class="font-display text-[2rem] font-semibold leading-tight tracking-[-0.035em] text-ink sm:text-[2.5rem]"
        >
          Records held outside the ledger.
        </h1>
        <p class="mt-2 max-w-2xl text-sm leading-6 text-ink-muted sm:text-[15px]">
          Restore an expense to active reporting, or permanently remove a record you no longer need.
        </p>
      </div>

      <div
        v-if="actionError"
        role="alert"
        class="rounded-xl border border-danger/25 bg-danger-soft px-4 py-3 text-sm text-danger"
      >
        {{ actionError }}
      </div>
    </header>

    <section class="min-w-0 overflow-hidden rounded-xl border border-line bg-surface shadow-card">
      <header class="border-b border-line px-5 py-4 sm:px-6">
        <p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
          Inactive records
        </p>
        <h2 class="font-display mt-1 text-lg font-semibold tracking-[-0.02em] text-ink">
          Archived expense ledger
        </h2>
        <p class="mt-1 text-xs text-ink-muted">
          {{ expenses.length }} archived expense{{ expenses.length === 1 ? '' : 's' }}
        </p>
      </header>

      <div
        v-if="loading"
        class="space-y-3 p-5 sm:p-6"
        role="status"
        aria-label="Loading archived expenses"
      >
        <div class="h-5 w-48 animate-pulse rounded bg-surface-muted"></div>
        <div class="space-y-2">
          <div class="h-20 animate-pulse rounded-lg bg-surface-muted/70"></div>
          <div class="h-20 animate-pulse rounded-lg bg-surface-muted/70"></div>
        </div>
      </div>

      <div
        v-else-if="error"
        role="alert"
        class="m-5 rounded-lg border border-danger/25 bg-danger-soft px-4 py-5 text-sm text-danger sm:m-6"
      >
        <p class="font-medium">Could not load archived expenses</p>
        <p class="mt-1">{{ error }}</p>
      </div>

      <div v-else-if="expenses.length === 0" class="px-5 py-14 text-center sm:px-6">
        <span
          class="mx-auto flex size-11 items-center justify-center rounded-lg bg-surface-muted text-ink-muted"
        >
          <ArchiveRestore :size="20" aria-hidden="true" />
        </span>
        <p class="mt-3 text-sm font-semibold text-ink">No archived expenses</p>
        <p class="mt-1 text-sm text-ink-muted">Archived records will appear here for review.</p>
      </div>

      <div v-else class="divide-y divide-line">
        <article
          v-for="expense in expenses"
          :key="expense.id"
          data-archived-expense-record
          class="relative min-w-0 px-4 py-5 transition hover:bg-surface-muted/45 sm:px-6"
        >
          <span class="absolute inset-y-0 left-0 w-0.5 bg-line-strong" aria-hidden="true" />
          <div
            class="relative flex min-w-0 flex-col gap-2 md:static md:gap-4 lg:flex-row lg:items-center lg:justify-between"
          >
            <div class="flex min-w-0 items-start gap-3.5 pr-12 sm:pr-0">
              <span
                class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-ink-muted"
              >
                <ReceiptText :size="17" aria-hidden="true" />
              </span>
              <div class="min-w-0">
                <h3 class="truncate text-base font-semibold tracking-[-0.015em] text-ink">
                  {{ expense.description }}
                </h3>
                <div
                  class="mt-2.5 grid min-w-0 grid-cols-1 gap-y-1.5 text-xs text-ink-muted sm:flex sm:flex-wrap sm:gap-x-3"
                >
                  <span class="truncate">{{
                    vendorNameById.get(expense.vendorId) ?? 'Unknown vendor'
                  }}</span>
                  <span class="truncate">{{
                    categoryNameById.get(expense.categoryId ?? '') ?? 'No category'
                  }}</span>
                  <span>{{ formatDate(expense.expenseDate) }}</span>
                </div>
                <p v-if="expense.notes" class="mt-2 text-sm text-ink-muted">
                  {{ expense.notes }}
                </p>
                <p v-if="expense.archivedAt" class="mt-2 text-xs text-ink-muted">
                  Archived
                  <time :datetime="expense.archivedAt" class="font-figure">
                    {{ formatDateTime(expense.archivedAt) }}
                  </time>
                </p>
              </div>
            </div>

            <div class="flex min-w-0 flex-wrap items-center justify-end gap-2 lg:justify-end">
              <span class="font-figure mr-auto text-base font-semibold text-ink sm:mr-2">
                ${{ formatAmount(expense.amount) }}
              </span>

              <button
                type="button"
                :aria-label="`Restore ${expense.description}`"
                title="Restore expense"
                :disabled="restoringId === expense.id"
                class="hidden min-h-11 min-w-11 items-center justify-center rounded-xl bg-brand-soft px-2.5 text-brand transition hover:bg-brand hover:text-white disabled:cursor-not-allowed disabled:opacity-60 sm:inline-flex"
                @click="restore(expense)"
              >
                <ArchiveRestore :size="17" :stroke-width="1.8" aria-hidden="true" />
              </button>

              <button
                type="button"
                :aria-label="`Remove ${expense.description}`"
                title="Remove expense"
                :disabled="removingId === expense.id"
                class="hidden min-h-11 min-w-11 items-center justify-center rounded-xl bg-danger-soft px-2.5 text-danger transition hover:bg-danger hover:text-white disabled:cursor-not-allowed disabled:opacity-60 sm:inline-flex"
                @click="remove(expense)"
              >
                <Trash2 :size="17" :stroke-width="1.8" aria-hidden="true" />
              </button>

              <span class="border-l-2 border-line-strong pl-2 text-xs font-semibold text-ink-muted">
                Archived
              </span>
              <button
                type="button"
                data-mobile-archived-expense-actions
                class="absolute right-0 top-0 inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-surface px-2.5 text-ink-muted transition hover:bg-surface-muted hover:text-ink sm:hidden"
                :aria-label="`Actions for ${expense.description}`"
                @click="openMobileActions(expense)"
              >
                <EllipsisVertical :size="18" aria-hidden="true" />
              </button>
            </div>
          </div>
        </article>
      </div>
    </section>

    <RecordActionSheet
      :open="mobileActionsOpen"
      :record-label="activeActionExpense?.description ?? 'expense'"
      :actions="mobileExpenseActions"
      @update:open="mobileActionsOpen = $event"
      @select="handleMobileAction"
    />
  </section>
</template>
