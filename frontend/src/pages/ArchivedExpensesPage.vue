<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
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

onMounted(loadArchivedExpensesPage)
</script>

<template>
  <section class="space-y-8">
    <header class="space-y-3">
      <p class="text-xs font-semibold uppercase tracking-[0.24em] text-stone-400">Expenses</p>

      <div>
        <h2 class="text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">
          Archived expenses
        </h2>
        <p class="mt-2 max-w-2xl text-sm leading-6 text-stone-500 sm:text-base">
          Restore archived expenses when they should reappear in active reporting, or remove them
          permanently.
        </p>
      </div>

      <div
        v-if="actionError"
        role="alert"
        class="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
      >
        {{ actionError }}
      </div>
    </header>

    <section class="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
      <div v-if="loading" class="space-y-3" role="status" aria-label="Loading archived expenses">
        <div class="h-5 w-48 animate-pulse rounded bg-stone-200"></div>
        <div class="space-y-2">
          <div class="h-16 animate-pulse rounded-2xl bg-stone-100"></div>
          <div class="h-16 animate-pulse rounded-2xl bg-stone-100"></div>
        </div>
      </div>

      <div
        v-else-if="error"
        role="alert"
        class="rounded-2xl border border-red-200 bg-red-50 px-4 py-5 text-sm text-red-700"
      >
        <p class="font-medium">Could not load archived expenses</p>
        <p class="mt-1">{{ error }}</p>
      </div>

      <div
        v-else-if="expenses.length === 0"
        class="rounded-2xl border border-dashed border-stone-200 bg-stone-50 px-5 py-12 text-center"
      >
        <p class="text-base font-medium text-stone-700">No archived expenses</p>
      </div>

      <div v-else class="space-y-3">
        <article
          v-for="expense in expenses"
          :key="expense.id"
          class="rounded-2xl border border-stone-200 bg-stone-50 px-5 py-4 transition hover:border-stone-300 hover:bg-stone-100"
        >
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0">
              <h3 class="text-base font-semibold tracking-tight text-stone-900">
                {{ expense.description }}
              </h3>
              <div class="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-stone-500">
                <span>{{ vendorNameById.get(expense.vendorId) ?? 'Unknown vendor' }}</span>
                <span>{{ categoryNameById.get(expense.categoryId ?? '') ?? 'No category' }}</span>
                <span>{{ formatDate(expense.expenseDate) }}</span>
              </div>
              <p v-if="expense.notes" class="mt-2 text-sm text-stone-500">
                {{ expense.notes }}
              </p>
              <p v-if="expense.archivedAt" class="mt-2 text-xs text-stone-500">
                Archived
                <time :datetime="expense.archivedAt">
                  {{ formatDateTime(expense.archivedAt) }}
                </time>
              </p>
            </div>

            <div class="flex shrink-0 items-center gap-3">
              <span class="text-sm font-semibold text-stone-900">
                {{ formatAmount(expense.amount) }}
              </span>

              <button
                type="button"
                :aria-label="`Restore ${expense.description}`"
                :disabled="restoringId === expense.id"
                class="inline-flex items-center rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-600 transition hover:border-stone-300 hover:text-stone-900 disabled:cursor-not-allowed disabled:opacity-60"
                @click="restore(expense)"
              >
                {{ restoringId === expense.id ? 'Restoring...' : 'Restore' }}
              </button>

              <button
                type="button"
                :aria-label="`Remove ${expense.description}`"
                :disabled="removingId === expense.id"
                class="inline-flex items-center rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-600 transition hover:border-stone-300 hover:text-stone-900 disabled:cursor-not-allowed disabled:opacity-60"
                @click="remove(expense)"
              >
                {{ removingId === expense.id ? 'Removing...' : 'Remove' }}
              </button>

              <span
                class="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-medium text-stone-500 ring-1 ring-stone-200"
              >
                Archived
              </span>
            </div>
          </div>
        </article>
      </div>
    </section>
  </section>
</template>
