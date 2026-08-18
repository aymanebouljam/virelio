<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ZodError } from 'zod'
import {
  Archive,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Filter,
  Pencil,
  Plus,
  ReceiptText,
  Search,
  Store,
  Tags,
} from '@lucide/vue'
import { ApiError } from '@/lib/api'
import { useRoute, useRouter } from 'vue-router'
import { archiveExpense, createExpense, fetchExpenses, updateExpense } from '@/lib/expenses/api'
import {
  expenseFormSchema,
  expenseSchema,
  type Expense,
  type ExpenseFormValues,
  type ExpensePayload,
} from '@/lib/expenses/schema'
import { fetchExpenseCategories } from '@/lib/expense-categories/api'
import { expenseCategorySchema, type ExpenseCategory } from '@/lib/expense-categories/schema'
import { fetchVendors } from '@/lib/vendors/api'
import { formatAmount, formatDate } from '@/lib/helpers'
import { type Vendor, vendorSchema } from '@/lib/vendors/schema'
import { mapZodErrors } from '@/lib/zod'

const expenses = ref<Expense[]>([])
const PAGE_SIZE = 6
const vendors = ref<Vendor[]>([])
const categories = ref<ExpenseCategory[]>([])
const route = useRoute()
const router = useRouter()

const loading = ref(true)
const error = ref('')
const actionError = ref('')
const showForm = ref(false)
const editingId = ref<string | null>(null)
const submitting = ref(false)
const submitError = ref('')
const formErrors = ref<Record<string, string>>({})
const pagination = ref({
  page: 1,
  pageSize: PAGE_SIZE,
  totalItems: 0,
  totalPages: 0,
})

const filters = reactive({
  search: readQueryValue('search'),
  vendorId: readQueryValue('vendorId'),
  categoryId: readQueryValue('categoryId'),
  dateFrom: readQueryValue('dateFrom'),
  dateTo: readQueryValue('dateTo'),
})

const hasFilters = computed(() => Object.values(readRouteFilters()).some(Boolean))
const activeFilterCount = computed(() => Object.values(readRouteFilters()).filter(Boolean).length)

function readQueryValue(key: string) {
  const value = route.query[key]
  return typeof value === 'string' ? value : ''
}

function readRouteFilters() {
  return {
    search: readQueryValue('search') || undefined,
    vendorId: readQueryValue('vendorId') || undefined,
    categoryId: readQueryValue('categoryId') || undefined,
    dateFrom: readQueryValue('dateFrom') || undefined,
    dateTo: readQueryValue('dateTo') || undefined,
  }
}

function readPageQuery() {
  const value = route.query.page
  if (typeof value !== 'string') return 1

  const page = Number(value)
  return Number.isInteger(page) && page > 0 ? page : 1
}

function syncFiltersFromRoute() {
  filters.search = readQueryValue('search')
  filters.vendorId = readQueryValue('vendorId')
  filters.categoryId = readQueryValue('categoryId')
  filters.dateFrom = readQueryValue('dateFrom')
  filters.dateTo = readQueryValue('dateTo')
}

async function applyFilters() {
  const query = Object.fromEntries(
    Object.entries(filters)
      .map(([key, value]) => [key, value.trim()])
      .filter((entry) => entry[1]),
  )

  await router.replace({ query })
}

async function clearFilters() {
  Object.assign(filters, {
    search: '',
    vendorId: '',
    categoryId: '',
    dateFrom: '',
    dateTo: '',
  })
  await applyFilters()
}

async function changePage(page: number) {
  if (page < 1) return

  const query = { ...route.query }
  if (page === 1) {
    delete query.page
  } else {
    query.page = String(page)
  }

  await router.replace({ query })
}

const today = new Date().toISOString().slice(0, 10)

const baseline = ref<ExpenseFormValues>({
  vendorId: '',
  categoryId: '',
  description: '',
  amount: 0,
  expenseDate: today,
  notes: '',
})

const form = ref<ExpenseFormValues>({
  vendorId: '',
  categoryId: '',
  description: '',
  amount: 0,
  expenseDate: today,
  notes: '',
})

const vendorNameById = computed(
  () => new Map(vendors.value.map((vendor) => [vendor.id, vendor.name])),
)

const categoryNameById = computed(
  () => new Map(categories.value.map((category) => [category.id, category.name])),
)

function resetForm() {
  const emptyState: ExpenseFormValues = {
    vendorId: '',
    categoryId: '',
    description: '',
    amount: 0,
    expenseDate: today,
    notes: '',
  }

  baseline.value = { ...emptyState }
  form.value = { ...emptyState }
  editingId.value = null
  showForm.value = false
  submitError.value = ''
  formErrors.value = {}
}

function openCreateForm() {
  resetForm()
  showForm.value = true
}
function openExpense(expense: Expense) {
  void router.push(`/expenses/${expense.id}`)
}

function openEditForm(expense: Expense) {
  const normalized: ExpenseFormValues = {
    vendorId: expense.vendorId,
    categoryId: expense.categoryId ?? '',
    description: expense.description,
    amount: Number(expense.amount),
    expenseDate: expense.expenseDate.slice(0, 10),
    notes: expense.notes ?? '',
  }

  baseline.value = { ...normalized }
  form.value = { ...normalized }
  editingId.value = expense.id
  showForm.value = true
  submitError.value = ''
  formErrors.value = {}
  actionError.value = ''
}

function normalizePayload(input: ExpenseFormValues): ExpensePayload {
  return {
    vendorId: input.vendorId,
    categoryId: input.categoryId || undefined,
    description: input.description,
    amount: input.amount,
    expenseDate: input.expenseDate,
    notes: input.notes || undefined,
  }
}

function isSameForm(left: ExpenseFormValues, right: ExpenseFormValues) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function normalizeApiErrors(err: ApiError) {
  if (!err.content || typeof err.content !== 'object') {
    submitError.value = err.message
    return
  }

  formErrors.value = err.content as Record<string, string>
}

function normalizeError(err: unknown) {
  if (err instanceof ApiError) {
    normalizeApiErrors(err)
    return
  }

  if (err instanceof ZodError) {
    formErrors.value = mapZodErrors(err.issues)
    return
  }

  submitError.value = 'Something went wrong'
}

function getListError(err: unknown) {
  return err instanceof ApiError ? (err.content?.dateRange ?? err.message) : 'Something went wrong'
}

async function fetchValidatedExpensesPage() {
  const requestedPage = readPageQuery()
  const response = await fetchExpenses({
    ...readRouteFilters(),
    page: requestedPage,
    pageSize: PAGE_SIZE,
  })
  const lastPage = Math.max(response.pagination.totalPages, 1)
  if (requestedPage > lastPage) {
    await changePage(lastPage)
    return
  }

  const items = response.items
    .map((expense) => expenseSchema.safeParse(expense))
    .filter((result) => result.success)
    .map((result) => result.data)

  return { items, pagination: response.pagination }
}

async function loadExpensesPage() {
  try {
    error.value = ''

    const [expensePage, rawVendors, rawCategories] = await Promise.all([
      fetchValidatedExpensesPage(),
      fetchVendors(),
      fetchExpenseCategories(),
    ])

    if (expensePage) {
      expenses.value = expensePage.items
      pagination.value = expensePage.pagination
    }

    vendors.value = rawVendors
      .map((vendor) => vendorSchema.safeParse(vendor))
      .filter((result) => result.success)
      .map((result) => result.data)

    categories.value = rawCategories
      .map((category) => expenseCategorySchema.safeParse(category))
      .filter((result) => result.success)
      .map((result) => result.data)
  } catch (err) {
    error.value = getListError(err)
  } finally {
    loading.value = false
  }
}

async function reloadExpenses() {
  try {
    error.value = ''
    const expensePage = await fetchValidatedExpensesPage()
    if (expensePage) {
      expenses.value = expensePage.items
      pagination.value = expensePage.pagination
    }
  } catch (err) {
    error.value = getListError(err)
  } finally {
    loading.value = false
  }
}

async function loadFirstUnfilteredPage() {
  if (route.fullPath !== '/expenses') {
    await router.replace({ path: '/expenses' })
  } else {
    loading.value = true
    await reloadExpenses()
  }
}

async function submitForm() {
  submitError.value = ''
  formErrors.value = {}
  actionError.value = ''
  submitting.value = true

  try {
    const validation = expenseFormSchema.parse(form.value)
    const payload = normalizePayload(validation)

    if (!editingId.value) {
      const result = expenseSchema.safeParse(await createExpense(payload))
      if (!result.success) {
        resetForm()
        actionError.value = 'Failed to fetch created expense'
        return
      }

      await loadFirstUnfilteredPage()
    } else if (!isSameForm(form.value, baseline.value)) {
      const result = expenseSchema.safeParse(await updateExpense(editingId.value, payload))

      if (!result.success) {
        resetForm()
        actionError.value = 'Failed to fetch updated expense'
        return
      }

      await reloadExpenses()
    }

    resetForm()
  } catch (err) {
    normalizeError(err)
  } finally {
    submitting.value = false
  }
}

async function archive(expense: Expense) {
  actionError.value = ''

  try {
    if (!confirm('Are you sure you want to archive this expense?')) {
      return
    }

    expenseSchema.parse(await archiveExpense(expense.id))
    await reloadExpenses()
  } catch (err) {
    actionError.value = err instanceof ApiError ? err.message : 'Archiving expense failed'
  }
}

watch(
  () => route.fullPath,
  () => {
    syncFiltersFromRoute()
    loading.value = true
    void reloadExpenses()
  },
)

onMounted(loadExpensesPage)
</script>

<template>
  <section class="space-y-7">
    <header class="space-y-4">
      <div class="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p class="text-xs font-semibold uppercase tracking-[0.24em] text-accent">Spending</p>
          <h2 class="mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">Expenses</h2>
          <p class="mt-2 max-w-2xl text-sm leading-6 text-ink-muted sm:text-base">
            Keep every purchase organized, categorized, and easy to revisit.
          </p>
        </div>

        <button
          v-if="!showForm"
          type="button"
          class="inline-flex min-h-11 w-fit items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-white shadow-card transition hover:bg-brand-strong"
          @click="openCreateForm"
        >
          <Plus :size="17" aria-hidden="true" />
          Add expense
        </button>
      </div>

      <div
        v-if="actionError"
        role="alert"
        class="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
      >
        {{ actionError }}
      </div>
    </header>

    <form
      class="rounded-2xl border border-line bg-surface p-4 shadow-card"
      role="search"
      @submit.prevent="applyFilters"
    >
      <div class="mb-4 flex items-center justify-between gap-3">
        <div class="flex items-center gap-2">
          <span class="flex size-9 items-center justify-center rounded-xl bg-brand-soft text-brand">
            <Filter :size="17" aria-hidden="true" />
          </span>
          <div>
            <p class="text-sm font-semibold text-ink">Filter expenses</p>
            <p class="text-xs text-ink-muted">
              {{ activeFilterCount ? `${activeFilterCount} active` : 'Showing all records' }}
            </p>
          </div>
        </div>

        <button
          v-if="hasFilters"
          type="button"
          class="min-h-10 rounded-xl px-3 text-sm font-medium text-ink-muted transition hover:bg-surface-muted hover:text-ink"
          @click="clearFilters"
        >
          Clear
        </button>
      </div>

      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-12">
        <label class="sm:col-span-2 xl:col-span-4">
          <span class="mb-1.5 block text-xs font-medium text-ink-muted">Search</span>
          <span class="relative block">
            <Search
              :size="16"
              aria-hidden="true"
              class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
            />
            <input
              v-model="filters.search"
              type="search"
              maxlength="240"
              placeholder="Description, notes, vendor..."
              class="min-h-10 w-full rounded-xl border border-line bg-white py-2 pl-9 pr-3 text-sm text-ink outline-none transition hover:border-stone-300 focus:border-brand"
            />
          </span>
        </label>

        <label class="xl:col-span-2">
          <span class="mb-1.5 block text-xs font-medium text-ink-muted">Vendor</span>
          <select
            v-model="filters.vendorId"
            class="min-h-10 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition hover:border-stone-300 focus:border-brand"
          >
            <option value="">All vendors</option>
            <option v-for="vendor in vendors" :key="vendor.id" :value="vendor.id">
              {{ vendor.name }}
            </option>
          </select>
        </label>

        <label class="xl:col-span-2">
          <span class="mb-1.5 block text-xs font-medium text-ink-muted">Category</span>
          <select
            v-model="filters.categoryId"
            class="min-h-10 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition hover:border-stone-300 focus:border-brand"
          >
            <option value="">All categories</option>
            <option v-for="category in categories" :key="category.id" :value="category.id">
              {{ category.name }}
            </option>
          </select>
        </label>

        <label class="xl:col-span-2">
          <span class="mb-1.5 block text-xs font-medium text-ink-muted">From</span>
          <input
            v-model="filters.dateFrom"
            type="date"
            class="min-h-10 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition hover:border-stone-300 focus:border-brand"
          />
        </label>

        <label class="xl:col-span-2">
          <span class="mb-1.5 block text-xs font-medium text-ink-muted">To</span>
          <input
            v-model="filters.dateTo"
            type="date"
            class="min-h-10 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition hover:border-stone-300 focus:border-brand"
          />
        </label>
      </div>

      <div class="mt-4 flex justify-end border-t border-line pt-4">
        <button
          type="submit"
          class="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-white transition hover:bg-brand-strong"
        >
          <Search :size="16" aria-hidden="true" />
          Apply filters
        </button>
      </div>
    </form>

    <section
      v-if="showForm"
      class="overflow-hidden rounded-2xl border border-line bg-surface shadow-lifted"
    >
      <header
        class="flex items-center gap-3 border-b border-line bg-brand-soft/55 px-5 py-4 sm:px-6"
      >
        <span class="flex size-10 items-center justify-center rounded-xl bg-brand text-white">
          <Pencil v-if="editingId" :size="18" aria-hidden="true" />
          <Plus v-else :size="18" aria-hidden="true" />
        </span>
        <div>
          <h3 class="text-lg font-semibold tracking-tight text-ink">
            {{ editingId ? 'Edit expense' : 'Create expense' }}
          </h3>
          <p class="text-xs text-ink-muted">
            {{
              editingId ? 'Update the details for this record.' : 'Add a purchase to your ledger.'
            }}
          </p>
        </div>
      </header>

      <form aria-label="Expense form" class="space-y-5 p-5 sm:p-6" @submit.prevent="submitForm">
        <div class="grid gap-4 sm:grid-cols-2">
          <label class="block">
            <span class="mb-1.5 block text-sm font-medium text-ink">Vendor</span>
            <select
              id="expense-vendor"
              v-model="form.vendorId"
              :aria-describedby="formErrors.vendorId ? 'expense-vendor-error' : undefined"
              :aria-invalid="Boolean(formErrors.vendorId)"
              :class="[
                'min-h-11 w-full rounded-xl border bg-white px-3 py-2 text-sm text-ink outline-none transition',
                formErrors.vendorId
                  ? 'border-red-300 focus:border-red-500'
                  : 'border-line hover:border-stone-300 focus:border-brand',
              ]"
            >
              <option value="">Select vendor</option>
              <option v-for="vendor in vendors" :key="vendor.id" :value="vendor.id">
                {{ vendor.name }}
              </option>
            </select>
            <p
              v-if="formErrors.vendorId"
              id="expense-vendor-error"
              class="ml-3 mt-2 text-sm text-red-600"
            >
              {{ formErrors.vendorId }}
            </p>
          </label>

          <label class="block">
            <span class="mb-1.5 block text-sm font-medium text-ink">Category</span>
            <select
              id="expense-category"
              v-model="form.categoryId"
              :aria-describedby="formErrors.categoryId ? 'expense-category-error' : undefined"
              :aria-invalid="Boolean(formErrors.categoryId)"
              class="min-h-11 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition hover:border-stone-300 focus:border-brand"
            >
              <option value="">No category</option>
              <option v-for="category in categories" :key="category.id" :value="category.id">
                {{ category.name }}
              </option>
            </select>
            <p
              v-if="formErrors.categoryId"
              id="expense-category-error"
              class="ml-3 mt-2 text-sm text-red-600"
            >
              {{ formErrors.categoryId }}
            </p>
          </label>

          <label class="block sm:col-span-2">
            <span class="mb-1.5 block text-sm font-medium text-ink">Description</span>
            <input
              id="expense-description"
              v-model="form.description"
              type="text"
              maxlength="240"
              :aria-describedby="formErrors.description ? 'expense-description-error' : undefined"
              :aria-invalid="Boolean(formErrors.description)"
              :class="[
                'min-h-11 w-full rounded-xl border bg-white px-3 py-2 text-sm text-ink outline-none transition',
                formErrors.description
                  ? 'border-red-300 focus:border-red-500'
                  : 'border-line hover:border-stone-300 focus:border-brand',
              ]"
            />
            <p
              v-if="formErrors.description"
              id="expense-description-error"
              class="ml-3 mt-2 text-sm text-red-600"
            >
              {{ formErrors.description }}
            </p>
          </label>

          <label class="block">
            <span class="mb-1.5 block text-sm font-medium text-ink">Amount</span>
            <input
              id="expense-amount"
              v-model.number="form.amount"
              type="number"
              min="0.01"
              step="0.01"
              :aria-describedby="formErrors.amount ? 'expense-amount-error' : undefined"
              :aria-invalid="Boolean(formErrors.amount)"
              :class="[
                'min-h-11 w-full rounded-xl border bg-white px-3 py-2 text-sm text-ink outline-none transition',
                formErrors.amount
                  ? 'border-red-300 focus:border-red-500'
                  : 'border-line hover:border-stone-300 focus:border-brand',
              ]"
            />
            <p
              v-if="formErrors.amount"
              id="expense-amount-error"
              class="ml-3 mt-2 text-sm text-red-600"
            >
              {{ formErrors.amount }}
            </p>
          </label>

          <label class="block">
            <span class="mb-1.5 block text-sm font-medium text-ink">Expense date</span>
            <input
              id="expense-date"
              v-model="form.expenseDate"
              type="date"
              :aria-describedby="formErrors.expenseDate ? 'expense-date-error' : undefined"
              :aria-invalid="Boolean(formErrors.expenseDate)"
              :class="[
                'min-h-11 w-full rounded-xl border bg-white px-3 py-2 text-sm text-ink outline-none transition',
                formErrors.expenseDate
                  ? 'border-red-300 focus:border-red-500'
                  : 'border-line hover:border-stone-300 focus:border-brand',
              ]"
            />
            <p
              v-if="formErrors.expenseDate"
              id="expense-date-error"
              class="ml-3 mt-2 text-sm text-red-600"
            >
              {{ formErrors.expenseDate }}
            </p>
          </label>

          <label class="block sm:col-span-2">
            <span class="mb-1.5 block text-sm font-medium text-ink">Notes</span>
            <textarea
              id="expense-notes"
              v-model="form.notes"
              rows="4"
              maxlength="1000"
              :aria-describedby="formErrors.notes ? 'expense-notes-error' : undefined"
              :aria-invalid="Boolean(formErrors.notes)"
              :class="[
                'w-full rounded-xl border bg-white px-3 py-2 text-sm text-ink outline-none transition',
                formErrors.notes
                  ? 'border-red-300 focus:border-red-500'
                  : 'border-line hover:border-stone-300 focus:border-brand',
              ]"
            />
            <p
              v-if="formErrors.notes"
              id="expense-notes-error"
              class="ml-3 mt-2 text-sm text-red-600"
            >
              {{ formErrors.notes }}
            </p>
          </label>
        </div>

        <div
          v-if="submitError"
          role="alert"
          class="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {{ submitError }}
        </div>

        <div class="flex items-center justify-end gap-3">
          <button
            type="button"
            class="min-h-11 rounded-xl px-4 text-sm font-medium text-ink-muted transition hover:bg-surface-muted hover:text-ink"
            @click="resetForm"
          >
            Cancel
          </button>

          <button
            type="submit"
            :disabled="submitting"
            class="inline-flex min-h-11 items-center justify-center rounded-xl bg-brand px-4 text-sm font-semibold text-white transition hover:bg-brand-strong disabled:cursor-not-allowed disabled:bg-stone-400"
          >
            {{ submitting ? 'Saving...' : 'Save expense' }}
          </button>
        </div>
      </form>
    </section>

    <section class="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
      <header
        class="flex items-center justify-between gap-4 border-b border-line px-5 py-4 sm:px-6"
      >
        <div>
          <h3 class="text-base font-semibold text-ink">Expense ledger</h3>
          <p class="mt-0.5 text-xs text-ink-muted">
            {{ pagination.totalItems }} recorded expense{{ pagination.totalItems === 1 ? '' : 's' }}
          </p>
        </div>
        <span
          v-if="hasFilters"
          class="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent"
        >
          Filtered
        </span>
      </header>

      <div v-if="loading" class="space-y-3 p-5 sm:p-6" role="status" aria-label="Loading expenses">
        <div class="h-4 w-36 animate-pulse rounded bg-surface-muted"></div>
        <div class="space-y-3">
          <div class="h-24 animate-pulse rounded-2xl bg-surface-muted"></div>
          <div class="h-24 animate-pulse rounded-2xl bg-surface-muted"></div>
        </div>
      </div>

      <div
        v-else-if="error"
        role="alert"
        class="m-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-5 text-sm text-red-700 sm:m-6"
      >
        <p class="font-medium">Could not load expenses</p>
        <p class="mt-1">{{ error }}</p>
      </div>

      <div v-else-if="expenses.length === 0" class="px-5 py-14 text-center sm:px-6">
        <span
          class="mx-auto flex size-12 items-center justify-center rounded-2xl bg-brand-soft text-brand"
        >
          <ReceiptText :size="22" :stroke-width="1.7" aria-hidden="true" />
        </span>
        <p class="mt-4 text-base font-semibold text-ink">
          {{ hasFilters ? 'No matching expenses' : 'No expenses yet' }}
        </p>
        <p class="mx-auto mt-1 max-w-sm text-sm leading-6 text-ink-muted">
          {{
            hasFilters
              ? 'Adjust or clear the current filters to see more expenses.'
              : 'Add your first expense to begin building a clear spending history.'
          }}
        </p>
        <button
          v-if="hasFilters"
          type="button"
          class="mt-5 min-h-10 rounded-xl border border-line bg-white px-4 text-sm font-semibold text-ink transition hover:bg-surface-muted"
          @click="clearFilters"
        >
          Clear filters
        </button>
        <button
          v-else
          type="button"
          class="mt-5 inline-flex min-h-10 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-white transition hover:bg-brand-strong"
          @click="openCreateForm"
        >
          <Plus :size="16" aria-hidden="true" />
          Create first expense
        </button>
      </div>

      <div v-else>
        <div class="divide-y divide-line">
          <article
            v-for="expense in expenses"
            :key="expense.id"
            class="group px-5 py-5 transition hover:bg-surface-muted/45 sm:px-6"
          >
            <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div class="flex min-w-0 items-start gap-3.5">
                <span
                  class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand"
                >
                  <ReceiptText :size="18" :stroke-width="1.8" aria-hidden="true" />
                </span>
                <div class="min-w-0">
                  <h4 class="truncate text-sm font-semibold text-ink sm:text-base">
                    {{ expense.description }}
                  </h4>
                  <div class="mt-1.5 flex flex-wrap gap-x-3 gap-y-1.5 text-xs text-ink-muted">
                    <span class="inline-flex items-center gap-1.5">
                      <Store :size="13" aria-hidden="true" />
                      {{ vendorNameById.get(expense.vendorId) ?? 'Unknown vendor' }}
                    </span>
                    <span class="inline-flex items-center gap-1.5">
                      <Tags :size="13" aria-hidden="true" />
                      {{ categoryNameById.get(expense.categoryId ?? '') ?? 'No category' }}
                    </span>
                    <span class="inline-flex items-center gap-1.5">
                      <CalendarDays :size="13" aria-hidden="true" />
                      {{ formatDate(expense.expenseDate) }}
                    </span>
                  </div>
                  <p v-if="expense.notes" class="mt-2 line-clamp-2 text-sm text-ink-muted">
                    {{ expense.notes }}
                  </p>
                </div>
              </div>

              <div
                class="flex flex-wrap items-center justify-between gap-3 sm:flex-nowrap lg:justify-end"
              >
                <span class="mr-auto text-lg font-semibold tracking-tight text-ink sm:mr-2">
                  ${{ formatAmount(expense.amount) }}
                </span>

                <button
                  type="button"
                  class="inline-flex min-h-10 items-center rounded-xl bg-brand-soft px-3 text-sm font-semibold text-brand transition hover:bg-brand hover:text-white"
                  @click="openExpense(expense)"
                >
                  View
                </button>

                <button
                  type="button"
                  class="inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-ink-muted transition hover:bg-surface-muted hover:text-ink"
                  @click="openEditForm(expense)"
                >
                  <Pencil :size="14" aria-hidden="true" />
                  Edit
                </button>

                <button
                  type="button"
                  class="inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-ink-muted transition hover:bg-red-50 hover:text-red-700"
                  @click="archive(expense)"
                >
                  <Archive :size="14" aria-hidden="true" />
                  Archive
                </button>
              </div>
            </div>
          </article>
        </div>

        <nav
          v-if="pagination.totalPages > 1"
          aria-label="Expense pagination"
          class="flex flex-col gap-3 border-t border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"
        >
          <p class="text-sm text-ink-muted">
            Page {{ pagination.page }} of {{ pagination.totalPages }} ·
            {{ pagination.totalItems }} expenses
          </p>

          <div class="flex items-center gap-2">
            <button
              type="button"
              :disabled="pagination.page === 1"
              class="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-line bg-white px-3 text-sm font-medium text-ink-muted transition hover:border-stone-300 hover:text-ink disabled:cursor-not-allowed disabled:text-stone-300"
              @click="changePage(pagination.page - 1)"
            >
              <ChevronLeft :size="15" aria-hidden="true" />
              Previous
            </button>
            <button
              type="button"
              :disabled="pagination.page === pagination.totalPages"
              class="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-line bg-white px-3 text-sm font-medium text-ink-muted transition hover:border-stone-300 hover:text-ink disabled:cursor-not-allowed disabled:text-stone-300"
              @click="changePage(pagination.page + 1)"
            >
              Next
              <ChevronRight :size="15" aria-hidden="true" />
            </button>
          </div>
        </nav>
      </div>
    </section>
  </section>
</template>
