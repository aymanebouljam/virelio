<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ZodError } from 'zod'
import {
  Archive,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  EllipsisVertical,
  Eye,
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
import RecordActionSheet, { type RecordActionItem } from '@/components/ui/RecordActionSheet.vue'
import ResponsiveFormSurface from '@/components/ui/ResponsiveFormSurface.vue'
import ResponsiveSheet from '@/components/ui/ResponsiveSheet.vue'

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
const mobileFilterOpen = ref(false)
const mobileActionsOpen = ref(false)
const activeActionExpense = ref<Expense | null>(null)
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

async function applyMobileFilters() {
  await applyFilters()
  mobileFilterOpen.value = false
}

async function clearMobileFilters() {
  await clearFilters()
  mobileFilterOpen.value = false
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

const mobileExpenseActions = [
  { id: 'edit', label: 'Edit expense', icon: Pencil },
  { id: 'archive', label: 'Archive expense', icon: Archive, tone: 'danger' },
] as const satisfies readonly RecordActionItem[]

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

function updateFormOpen(open: boolean) {
  if (!open) {
    resetForm()
  }
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

function openMobileActions(expense: Expense) {
  activeActionExpense.value = expense
  mobileActionsOpen.value = true
}

function handleMobileAction(actionId: string) {
  const expense = activeActionExpense.value
  if (!expense) return

  mobileActionsOpen.value = false
  activeActionExpense.value = null

  if (actionId === 'edit') {
    openEditForm(expense)
  } else if (actionId === 'archive') {
    void archive(expense)
  }
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
  <section class="min-w-0 space-y-6">
    <header class="space-y-4 border-b border-line pb-6">
      <div class="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
            Expense register
          </p>
          <h1
            class="font-display mt-2 text-[2rem] font-semibold leading-tight tracking-[-0.035em] text-ink sm:text-[2.5rem]"
          >
            Every purchase, on the record.
          </h1>
          <p class="mt-2 max-w-2xl text-sm leading-6 text-ink-muted sm:text-[15px]">
            Find, review, and maintain the entries behind your spending totals.
          </p>
        </div>

        <button
          v-if="!showForm"
          type="button"
          class="inline-flex min-h-11 w-fit items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-white transition hover:bg-brand-strong max-[375px]:w-full"
          @click="openCreateForm"
        >
          <Plus :size="17" aria-hidden="true" />
          Add expense
        </button>
      </div>

      <div
        v-if="actionError"
        role="alert"
        class="rounded-xl border border-danger/25 bg-danger-soft px-4 py-3 text-sm text-danger"
      >
        {{ actionError }}
      </div>
    </header>

    <div
      class="rounded-xl border border-line border-l-2 bg-surface p-4 shadow-card md:hidden"
      :class="hasFilters ? 'border-l-accent' : 'border-l-line-strong'"
    >
      <div class="flex items-end gap-2 max-[375px]:flex-col max-[375px]:items-stretch">
        <label class="min-w-0 flex-1">
          <span class="mb-1.5 block text-xs font-medium text-ink-muted">Search expenses</span>
          <span class="relative block">
            <Search
              :size="16"
              aria-hidden="true"
              class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted/65"
            />
            <input
              data-mobile-expense-search
              v-model="filters.search"
              name="expense-search"
              type="search"
              maxlength="240"
              placeholder="Search expenses"
              class="min-h-11 w-full rounded-lg border border-line bg-surface-raised py-2 pl-9 pr-3 text-sm text-ink outline-none transition hover:border-line-strong focus:border-brand focus:bg-surface"
            />
          </span>
        </label>

        <button
          type="button"
          data-mobile-filter-trigger
          class="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-sm font-semibold text-brand transition hover:border-line-strong hover:bg-surface-muted max-[375px]:w-full"
          :aria-label="
            activeFilterCount ? `Open filters, ${activeFilterCount} active` : 'Open filters'
          "
          @click="mobileFilterOpen = true"
        >
          <Filter :size="16" aria-hidden="true" />
          <span v-if="activeFilterCount" class="font-figure">{{ activeFilterCount }}</span>
          <span>Filter</span>
        </button>
      </div>
      <p class="mt-2 text-xs text-ink-muted">
        {{
          activeFilterCount
            ? `${activeFilterCount} active filter${activeFilterCount === 1 ? '' : 's'}`
            : 'Showing all records'
        }}
      </p>
    </div>

    <form
      class="hidden rounded-xl border border-line border-l-2 bg-surface p-4 shadow-card md:block"
      :class="hasFilters ? 'border-l-accent' : 'border-l-line-strong'"
      role="search"
      @submit.prevent="applyFilters"
    >
      <div class="mb-4 flex items-center justify-between gap-3">
        <div class="flex items-center gap-2">
          <span class="flex size-9 items-center justify-center rounded-lg bg-brand-soft text-brand">
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
          class="min-h-10 rounded-lg px-3 text-sm font-medium text-ink-muted transition hover:bg-surface-muted hover:text-ink"
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
              class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted/65"
            />
            <input
              v-model="filters.search"
              name="expense-search"
              type="search"
              maxlength="240"
              placeholder="Description, notes, vendor..."
              class="min-h-10 w-full rounded-lg border border-line bg-surface-raised py-2 pl-9 pr-3 text-sm text-ink outline-none transition hover:border-line-strong focus:border-brand focus:bg-surface"
            />
          </span>
        </label>

        <label class="xl:col-span-2">
          <span class="mb-1.5 block text-xs font-medium text-ink-muted">Vendor</span>
          <select
            v-model="filters.vendorId"
            name="vendor-id"
            class="min-h-10 w-full rounded-lg border border-line bg-surface-raised px-3 py-2 text-sm text-ink outline-none transition hover:border-line-strong focus:border-brand focus:bg-surface"
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
            name="category-id"
            class="min-h-10 w-full rounded-lg border border-line bg-surface-raised px-3 py-2 text-sm text-ink outline-none transition hover:border-line-strong focus:border-brand focus:bg-surface"
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
            name="date-from"
            type="date"
            class="min-h-10 w-full rounded-lg border border-line bg-surface-raised px-3 py-2 text-sm text-ink outline-none transition hover:border-line-strong focus:border-brand focus:bg-surface"
          />
        </label>

        <label class="xl:col-span-2">
          <span class="mb-1.5 block text-xs font-medium text-ink-muted">To</span>
          <input
            v-model="filters.dateTo"
            name="date-to"
            type="date"
            class="min-h-10 w-full rounded-lg border border-line bg-surface-raised px-3 py-2 text-sm text-ink outline-none transition hover:border-line-strong focus:border-brand focus:bg-surface"
          />
        </label>
      </div>

      <div class="mt-4 flex justify-end border-t border-line pt-4">
        <button
          type="submit"
          class="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-white transition hover:bg-brand-strong"
        >
          <Search :size="16" aria-hidden="true" />
          Apply filters
        </button>
      </div>
    </form>

    <ResponsiveSheet
      v-model:open="mobileFilterOpen"
      title="Filter expenses"
      description="Narrow the expense register by vendor, category, or date."
      close-label="Close expense filters"
    >
      <form data-mobile-filter-form class="space-y-5" @submit.prevent="applyMobileFilters">
        <label class="block">
          <span class="mb-1.5 block text-sm font-medium text-ink">Vendor</span>
          <select
            id="mobile-expense-vendor-filter"
            v-model="filters.vendorId"
            class="min-h-11 w-full rounded-lg border border-line bg-surface-raised px-3 py-2 text-sm text-ink outline-none transition hover:border-line-strong focus:border-brand focus:bg-surface"
          >
            <option value="">All vendors</option>
            <option v-for="vendor in vendors" :key="vendor.id" :value="vendor.id">
              {{ vendor.name }}
            </option>
          </select>
        </label>

        <label class="block">
          <span class="mb-1.5 block text-sm font-medium text-ink">Category</span>
          <select
            id="mobile-expense-category-filter"
            v-model="filters.categoryId"
            class="min-h-11 w-full rounded-lg border border-line bg-surface-raised px-3 py-2 text-sm text-ink outline-none transition hover:border-line-strong focus:border-brand focus:bg-surface"
          >
            <option value="">All categories</option>
            <option v-for="category in categories" :key="category.id" :value="category.id">
              {{ category.name }}
            </option>
          </select>
        </label>

        <div class="grid gap-4 sm:grid-cols-2">
          <label class="block">
            <span class="mb-1.5 block text-sm font-medium text-ink">From</span>
            <input
              v-model="filters.dateFrom"
              name="date-from"
              type="date"
              class="min-h-11 w-full rounded-lg border border-line bg-surface-raised px-3 py-2 text-sm text-ink outline-none transition hover:border-line-strong focus:border-brand focus:bg-surface"
            />
          </label>

          <label class="block">
            <span class="mb-1.5 block text-sm font-medium text-ink">To</span>
            <input
              v-model="filters.dateTo"
              name="date-to"
              type="date"
              class="min-h-11 w-full rounded-lg border border-line bg-surface-raised px-3 py-2 text-sm text-ink outline-none transition hover:border-line-strong focus:border-brand focus:bg-surface"
            />
          </label>
        </div>

        <div
          class="flex flex-col-reverse gap-2 border-t border-line pt-5 sm:flex-row sm:justify-end"
        >
          <button
            v-if="hasFilters"
            type="button"
            class="inline-flex min-h-11 w-full items-center justify-center rounded-lg px-4 text-sm font-medium text-ink-muted transition hover:bg-surface-muted hover:text-ink sm:w-auto"
            @click="clearMobileFilters"
          >
            Clear filters
          </button>
          <button
            type="submit"
            class="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-white transition hover:bg-brand-strong sm:w-auto"
          >
            <Search :size="16" aria-hidden="true" />
            Apply filters
          </button>
        </div>
      </form>
    </ResponsiveSheet>

    <div v-if="showForm" data-expense-form-panel>
      <ResponsiveFormSurface
        :open="showForm"
        :eyebrow="editingId ? 'Revise record' : 'New record'"
        :title="editingId ? 'Edit expense' : 'Create expense'"
        :description="
          editingId ? 'Update the details for this record.' : 'Add a purchase to your ledger.'
        "
        @update:open="updateFormOpen"
      >
        <template #icon>
          <Pencil v-if="editingId" :size="18" aria-hidden="true" />
          <Plus v-else :size="18" aria-hidden="true" />
        </template>

        <form aria-label="Expense form" class="space-y-5" @submit.prevent="submitForm">
          <div class="grid gap-4 sm:grid-cols-2">
            <label class="block">
              <span class="mb-1.5 block text-sm font-medium text-ink">Vendor</span>
              <select
                id="expense-vendor"
                v-model="form.vendorId"
                :aria-describedby="formErrors.vendorId ? 'expense-vendor-error' : undefined"
                :aria-invalid="Boolean(formErrors.vendorId)"
                :class="[
                  'min-h-11 w-full rounded-lg border bg-surface-raised px-3 py-2 text-sm text-ink outline-none transition focus:bg-surface',
                  formErrors.vendorId
                    ? 'border-danger/45 focus:border-danger'
                    : 'border-line hover:border-line-strong focus:border-brand',
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
                class="mt-1.5 text-sm text-danger"
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
                :class="[
                  'min-h-11 w-full rounded-lg border bg-surface-raised px-3 py-2 text-sm text-ink outline-none transition focus:bg-surface',
                  formErrors.categoryId
                    ? 'border-danger/45 focus:border-danger'
                    : 'border-line hover:border-line-strong focus:border-brand',
                ]"
              >
                <option value="">No category</option>
                <option v-for="category in categories" :key="category.id" :value="category.id">
                  {{ category.name }}
                </option>
              </select>
              <p
                v-if="formErrors.categoryId"
                id="expense-category-error"
                class="mt-1.5 text-sm text-danger"
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
                  'min-h-11 w-full rounded-lg border bg-surface-raised px-3 py-2 text-sm text-ink outline-none transition focus:bg-surface',
                  formErrors.description
                    ? 'border-danger/45 focus:border-danger'
                    : 'border-line hover:border-line-strong focus:border-brand',
                ]"
              />
              <p
                v-if="formErrors.description"
                id="expense-description-error"
                class="mt-1.5 text-sm text-danger"
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
                inputmode="decimal"
                min="0.01"
                step="0.01"
                :aria-describedby="formErrors.amount ? 'expense-amount-error' : undefined"
                :aria-invalid="Boolean(formErrors.amount)"
                :class="[
                  'font-figure min-h-11 w-full rounded-lg border bg-surface-raised px-3 py-2 text-sm text-ink outline-none transition focus:bg-surface',
                  formErrors.amount
                    ? 'border-danger/45 focus:border-danger'
                    : 'border-line hover:border-line-strong focus:border-brand',
                ]"
              />
              <p
                v-if="formErrors.amount"
                id="expense-amount-error"
                class="mt-1.5 text-sm text-danger"
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
                  'min-h-11 w-full rounded-lg border bg-surface-raised px-3 py-2 text-sm text-ink outline-none transition focus:bg-surface',
                  formErrors.expenseDate
                    ? 'border-danger/45 focus:border-danger'
                    : 'border-line hover:border-line-strong focus:border-brand',
                ]"
              />
              <p
                v-if="formErrors.expenseDate"
                id="expense-date-error"
                class="mt-1.5 text-sm text-danger"
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
                  'w-full rounded-lg border bg-surface-raised px-3 py-2 text-sm text-ink outline-none transition focus:bg-surface',
                  formErrors.notes
                    ? 'border-danger/45 focus:border-danger'
                    : 'border-line hover:border-line-strong focus:border-brand',
                ]"
              />
              <p
                v-if="formErrors.notes"
                id="expense-notes-error"
                class="mt-1.5 text-sm text-danger"
              >
                {{ formErrors.notes }}
              </p>
            </label>
          </div>

          <div
            v-if="submitError"
            role="alert"
            class="rounded-lg border border-danger/25 bg-danger-soft px-4 py-3 text-sm text-danger"
          >
            {{ submitError }}
          </div>

          <div
            class="flex flex-col-reverse gap-2 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-end sm:gap-3"
          >
            <button
              type="button"
              class="min-h-11 w-full rounded-lg px-4 text-sm font-medium text-ink-muted transition hover:bg-surface-muted hover:text-ink sm:w-auto"
              @click="resetForm"
            >
              Cancel
            </button>

            <button
              type="submit"
              :disabled="submitting"
              class="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-brand px-4 text-sm font-semibold text-white transition hover:bg-brand-strong disabled:cursor-not-allowed disabled:bg-line-strong sm:w-auto"
            >
              {{ submitting ? 'Saving...' : 'Save expense' }}
            </button>
          </div>
        </form>
      </ResponsiveFormSurface>
    </div>

    <section
      data-expense-ledger
      class="min-w-0 overflow-hidden rounded-xl border border-line bg-surface shadow-card"
    >
      <header
        class="flex items-center justify-between gap-4 border-b border-line px-5 py-4 sm:px-6"
      >
        <div>
          <p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
            Recorded entries
          </p>
          <h2 class="font-display mt-1 text-lg font-semibold tracking-[-0.02em] text-ink">
            Expense ledger
          </h2>
          <p class="mt-0.5 text-xs text-ink-muted">
            {{ pagination.totalItems }} recorded expense{{ pagination.totalItems === 1 ? '' : 's' }}
          </p>
        </div>
        <span
          v-if="hasFilters"
          class="border-l-2 border-accent pl-2 text-xs font-semibold text-accent"
        >
          Filtered
        </span>
      </header>

      <div v-if="loading" class="space-y-3 p-5 sm:p-6" role="status" aria-label="Loading expenses">
        <div class="h-4 w-36 animate-pulse rounded bg-surface-muted"></div>
        <div class="space-y-3">
          <div class="h-24 animate-pulse rounded-lg bg-surface-muted"></div>
          <div class="h-24 animate-pulse rounded-lg bg-surface-muted"></div>
        </div>
      </div>

      <div
        v-else-if="error"
        role="alert"
        class="m-5 rounded-lg border border-danger/25 bg-danger-soft px-4 py-5 text-sm text-danger sm:m-6"
      >
        <p class="font-medium">Could not load expenses</p>
        <p class="mt-1">{{ error }}</p>
      </div>

      <div v-else-if="expenses.length === 0" class="px-5 py-14 text-center sm:px-6">
        <span
          class="mx-auto flex size-11 items-center justify-center rounded-lg bg-brand-soft text-brand"
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
          class="mt-5 min-h-10 rounded-lg border border-line bg-surface px-4 text-sm font-semibold text-ink transition hover:bg-surface-muted"
          @click="clearFilters"
        >
          Clear filters
        </button>
        <button
          v-else
          type="button"
          class="mt-5 inline-flex min-h-10 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-white transition hover:bg-brand-strong"
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
            data-expense-record
            class="group relative min-w-0 px-4 py-5 transition hover:bg-surface-muted/45 sm:px-6"
          >
            <span
              class="absolute inset-y-0 left-0 w-0.5 bg-transparent transition group-hover:bg-accent"
              aria-hidden="true"
            />
            <div class="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div class="flex min-w-0 items-start gap-3.5">
                <span
                  class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand"
                >
                  <ReceiptText :size="18" :stroke-width="1.8" aria-hidden="true" />
                </span>
                <div class="min-w-0">
                  <h4 class="truncate text-sm font-semibold text-ink sm:text-base">
                    {{ expense.description }}
                  </h4>
                  <div
                    class="mt-1.5 grid min-w-0 grid-cols-1 gap-y-1.5 text-xs text-ink-muted sm:flex sm:flex-wrap sm:gap-x-3"
                  >
                    <span class="inline-flex min-w-0 max-w-full items-center gap-1.5">
                      <Store :size="13" aria-hidden="true" />
                      <span class="truncate">{{
                        vendorNameById.get(expense.vendorId) ?? 'Unknown vendor'
                      }}</span>
                    </span>
                    <span class="inline-flex min-w-0 max-w-full items-center gap-1.5">
                      <Tags :size="13" aria-hidden="true" />
                      <span class="truncate">
                        {{ categoryNameById.get(expense.categoryId ?? '') ?? 'No category' }}
                      </span>
                    </span>
                    <span class="inline-flex min-w-0 max-w-full items-center gap-1.5">
                      <CalendarDays :size="13" aria-hidden="true" />
                      <span class="truncate">{{ formatDate(expense.expenseDate) }}</span>
                    </span>
                  </div>
                  <p v-if="expense.notes" class="mt-2 line-clamp-2 text-sm text-ink-muted">
                    {{ expense.notes }}
                  </p>
                </div>
              </div>

              <div
                class="flex min-w-0 flex-wrap items-center justify-between gap-3 sm:flex-nowrap lg:justify-end"
              >
                <span
                  class="font-figure mr-auto text-lg font-semibold tracking-[-0.025em] text-ink sm:mr-2"
                >
                  ${{ formatAmount(expense.amount) }}
                </span>

                <button
                  type="button"
                  class="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg bg-brand-soft px-2.5 text-brand transition hover:bg-brand hover:text-white"
                  :aria-label="`View ${expense.description}`"
                  title="View expense"
                  @click="openExpense(expense)"
                >
                  <Eye :size="17" :stroke-width="1.8" aria-hidden="true" />
                </button>

                <button
                  type="button"
                  class="hidden min-h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-ink-muted transition hover:bg-surface-muted hover:text-ink md:inline-flex"
                  @click="openEditForm(expense)"
                >
                  <Pencil :size="14" aria-hidden="true" />
                  Edit
                </button>

                <button
                  type="button"
                  class="hidden min-h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-ink-muted transition hover:bg-danger-soft hover:text-danger md:inline-flex"
                  @click="archive(expense)"
                >
                  <Archive :size="14" aria-hidden="true" />
                  Archive
                </button>

                <button
                  type="button"
                  data-mobile-record-actions
                  class="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-line bg-surface px-2.5 text-ink-muted transition hover:border-line-strong hover:bg-surface-muted hover:text-ink md:hidden"
                  :aria-label="`Actions for ${expense.description}`"
                  @click="openMobileActions(expense)"
                >
                  <EllipsisVertical :size="18" aria-hidden="true" />
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
              class="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-sm font-medium text-ink-muted transition hover:border-line-strong hover:text-ink disabled:cursor-not-allowed disabled:text-line-strong"
              @click="changePage(pagination.page - 1)"
            >
              <ChevronLeft :size="15" aria-hidden="true" />
              Previous
            </button>
            <button
              type="button"
              :disabled="pagination.page === pagination.totalPages"
              class="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-sm font-medium text-ink-muted transition hover:border-line-strong hover:text-ink disabled:cursor-not-allowed disabled:text-line-strong"
              @click="changePage(pagination.page + 1)"
            >
              Next
              <ChevronRight :size="15" aria-hidden="true" />
            </button>
          </div>
        </nav>
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
