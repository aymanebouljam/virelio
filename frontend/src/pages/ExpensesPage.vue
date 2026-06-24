<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ZodError } from 'zod'
import { ApiError } from '@/lib/api'
import { useRouter } from 'vue-router'
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
const vendors = ref<Vendor[]>([])
const categories = ref<ExpenseCategory[]>([])
const router = useRouter()

const loading = ref(true)
const error = ref('')
const actionError = ref('')
const showForm = ref(false)
const editingId = ref<string | null>(null)
const submitting = ref(false)
const submitError = ref('')
const formErrors = ref<Record<string, string>>({})

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

async function loadExpensesPage() {
  try {
    error.value = ''

    const [rawExpenses, rawVendors, rawCategories] = await Promise.all([
      fetchExpenses(),
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

      expenses.value = [result.data, ...expenses.value]
    } else if (!isSameForm(form.value, baseline.value)) {
      const result = expenseSchema.safeParse(await updateExpense(editingId.value, payload))

      if (!result.success) {
        resetForm()
        actionError.value = 'Failed to fetch updated expense'
        return
      }

      expenses.value = expenses.value.map((expense) =>
        expense.id === result.data.id ? result.data : expense,
      )
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

    const archived = expenseSchema.parse(await archiveExpense(expense.id))
    expenses.value = expenses.value.filter((item) => item.id !== archived.id)
  } catch (err) {
    actionError.value = err instanceof ApiError ? err.message : 'Archiving expense failed'
  }
}

onMounted(loadExpensesPage)
</script>

<template>
  <section class="space-y-8">
    <header class="space-y-3">
      <p class="text-xs font-semibold uppercase tracking-[0.24em] text-stone-400">Expenses</p>

      <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 class="text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">Expenses</h2>
          <p class="mt-2 max-w-2xl text-sm leading-6 text-stone-500 sm:text-base">
            Track operational spending with vendor and category references.
          </p>
        </div>

        <div v-if="!showForm">
          <button
            type="button"
            class="inline-flex items-center justify-center rounded-2xl bg-stone-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-stone-700"
            @click="openCreateForm"
          >
            Add expense
          </button>
        </div>
      </div>

      <div
        v-if="actionError"
        class="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
      >
        {{ actionError }}
      </div>
    </header>

    <section v-if="showForm" class="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
      <h3 class="text-lg font-semibold tracking-tight text-stone-900">
        {{ editingId ? 'Edit expense' : 'Create expense' }}
      </h3>

      <form class="mt-6 space-y-5" @submit.prevent="submitForm">
        <div class="grid gap-4 sm:grid-cols-2">
          <label class="block">
            <span class="mb-2 block text-sm font-medium text-stone-700">Vendor</span>
            <select
              v-model="form.vendorId"
              :class="[
                'w-full rounded-2xl border bg-white px-4 py-3 text-sm text-stone-900 outline-none transition',
                formErrors.vendorId
                  ? 'border-red-300 focus:border-red-500'
                  : 'border-stone-300 focus:border-stone-900',
              ]"
            >
              <option value="">Select vendor</option>
              <option v-for="vendor in vendors" :key="vendor.id" :value="vendor.id">
                {{ vendor.name }}
              </option>
            </select>
            <p v-if="formErrors.vendorId" class="ml-3 mt-2 text-sm text-red-600">
              {{ formErrors.vendorId }}
            </p>
          </label>

          <label class="block">
            <span class="mb-2 block text-sm font-medium text-stone-700">Category</span>
            <select
              v-model="form.categoryId"
              class="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-stone-900"
            >
              <option value="">No category</option>
              <option v-for="category in categories" :key="category.id" :value="category.id">
                {{ category.name }}
              </option>
            </select>
            <p v-if="formErrors.categoryId" class="ml-3 mt-2 text-sm text-red-600">
              {{ formErrors.categoryId }}
            </p>
          </label>

          <label class="block sm:col-span-2">
            <span class="mb-2 block text-sm font-medium text-stone-700">Description</span>
            <input
              v-model="form.description"
              type="text"
              maxlength="240"
              :class="[
                'w-full rounded-2xl border bg-white px-4 py-3 text-sm text-stone-900 outline-none transition',
                formErrors.description
                  ? 'border-red-300 focus:border-red-500'
                  : 'border-stone-300 focus:border-stone-900',
              ]"
            />
            <p v-if="formErrors.description" class="ml-3 mt-2 text-sm text-red-600">
              {{ formErrors.description }}
            </p>
          </label>

          <label class="block">
            <span class="mb-2 block text-sm font-medium text-stone-700">Amount</span>
            <input
              v-model.number="form.amount"
              type="number"
              min="0.01"
              step="0.01"
              :class="[
                'w-full rounded-2xl border bg-white px-4 py-3 text-sm text-stone-900 outline-none transition',
                formErrors.amount
                  ? 'border-red-300 focus:border-red-500'
                  : 'border-stone-300 focus:border-stone-900',
              ]"
            />
            <p v-if="formErrors.amount" class="ml-3 mt-2 text-sm text-red-600">
              {{ formErrors.amount }}
            </p>
          </label>

          <label class="block">
            <span class="mb-2 block text-sm font-medium text-stone-700">Expense date</span>
            <input
              v-model="form.expenseDate"
              type="date"
              :class="[
                'w-full rounded-2xl border bg-white px-4 py-3 text-sm text-stone-900 outline-none transition',
                formErrors.expenseDate
                  ? 'border-red-300 focus:border-red-500'
                  : 'border-stone-300 focus:border-stone-900',
              ]"
            />
            <p v-if="formErrors.expenseDate" class="ml-3 mt-2 text-sm text-red-600">
              {{ formErrors.expenseDate }}
            </p>
          </label>

          <label class="block sm:col-span-2">
            <span class="mb-2 block text-sm font-medium text-stone-700">Notes</span>
            <textarea
              v-model="form.notes"
              rows="4"
              maxlength="1000"
              :class="[
                'w-full rounded-2xl border bg-white px-4 py-3 text-sm text-stone-900 outline-none transition',
                formErrors.notes
                  ? 'border-red-300 focus:border-red-500'
                  : 'border-stone-300 focus:border-stone-900',
              ]"
            />
            <p v-if="formErrors.notes" class="ml-3 mt-2 text-sm text-red-600">
              {{ formErrors.notes }}
            </p>
          </label>
        </div>

        <div
          v-if="submitError"
          class="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {{ submitError }}
        </div>

        <div class="flex items-center justify-end gap-3">
          <button
            type="button"
            class="rounded-2xl px-4 py-3 text-sm font-medium text-stone-600 transition hover:bg-stone-100 hover:text-stone-900"
            @click="resetForm"
          >
            Cancel
          </button>

          <button
            type="submit"
            :disabled="submitting"
            class="inline-flex items-center justify-center rounded-2xl bg-stone-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:bg-stone-400"
          >
            {{ submitting ? 'Saving...' : 'Save expense' }}
          </button>
        </div>
      </form>
    </section>

    <section class="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
      <div v-if="loading" class="space-y-3">
        <div class="h-5 w-40 animate-pulse rounded bg-stone-200"></div>
        <div class="space-y-2">
          <div class="h-16 animate-pulse rounded-2xl bg-stone-100"></div>
          <div class="h-16 animate-pulse rounded-2xl bg-stone-100"></div>
        </div>
      </div>

      <div
        v-else-if="error"
        class="rounded-2xl border border-red-200 bg-red-50 px-4 py-5 text-sm text-red-700"
      >
        <p class="font-medium">Could not load expenses</p>
        <p class="mt-1">{{ error }}</p>
      </div>

      <div
        v-else-if="expenses.length === 0"
        class="rounded-2xl border border-dashed border-stone-200 bg-stone-50 px-5 py-12 text-center"
      >
        <p class="text-base font-medium text-stone-700">No expenses yet</p>
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
            </div>

            <div class="flex shrink-0 items-center gap-3">
              <span class="text-sm font-semibold text-stone-900">
                {{ formatAmount(expense.amount) }}
              </span>

              <button
                type="button"
                class="inline-flex items-center rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-600 transition hover:border-stone-300 hover:text-stone-900"
                @click="openExpense(expense)"
              >
                View
              </button>

              <button
                type="button"
                class="inline-flex items-center rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-600 transition hover:border-stone-300 hover:text-stone-900"
                @click="openEditForm(expense)"
              >
                Edit
              </button>

              <button
                type="button"
                class="inline-flex items-center rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-700 transition hover:border-red-300 hover:text-red-800"
                @click="archive(expense)"
              >
                Archive
              </button>
            </div>
          </div>
        </article>
      </div>
    </section>
  </section>
</template>
