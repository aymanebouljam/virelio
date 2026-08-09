<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ZodError } from 'zod'
import { ApiError } from '@/lib/api'
import { fetchExpenseCategories } from '@/lib/expense-categories/api'
import { expenseCategorySchema, type ExpenseCategory } from '@/lib/expense-categories/schema'
import { expenseSchema } from '@/lib/expenses/schema'
import { formatAmount, formatDate } from '@/lib/helpers'
import {
  archiveRecurringExpense,
  createRecurringExpense,
  fetchRecurringExpenses,
  generateRecurringExpense,
  updateRecurringExpense,
} from '@/lib/recurring-expenses/api'
import {
  recurringExpenseFormSchema,
  recurringExpenseRecordSchema,
  recurringExpenseTemplateSchema,
  type RecurringExpenseFormValues,
  type RecurringExpensePayload,
  type RecurringExpenseTemplate,
} from '@/lib/recurring-expenses/schema'
import { fetchVendors } from '@/lib/vendors/api'
import { vendorSchema, type Vendor } from '@/lib/vendors/schema'
import { mapZodErrors } from '@/lib/zod'

const PAGE_SIZE = 6
const route = useRoute()
const router = useRouter()
const templates = ref<RecurringExpenseTemplate[]>([])
const vendors = ref<Vendor[]>([])
const categories = ref<ExpenseCategory[]>([])
const loading = ref(true)
const error = ref('')
const actionError = ref('')
const showForm = ref(false)
const editingId = ref<string | null>(null)
const submitting = ref(false)
const generatingId = ref<string | null>(null)
const submitError = ref('')
const formErrors = ref<Record<string, string>>({})
const pagination = ref({
  page: 1,
  pageSize: PAGE_SIZE,
  totalItems: 0,
  totalPages: 0,
})

const emptyForm = (): RecurringExpenseFormValues => ({
  vendorId: '',
  categoryId: '',
  description: '',
  amount: 0,
  frequency: 'MONTHLY',
  nextDueDate: new Date().toISOString().slice(0, 10),
  notes: '',
})

const baseline = ref(emptyForm())
const form = ref(emptyForm())

function readPageQuery() {
  const value = route.query.page
  if (typeof value !== 'string') return 1

  const page = Number(value)
  return Number.isInteger(page) && page > 0 ? page : 1
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

function resetForm() {
  baseline.value = emptyForm()
  form.value = emptyForm()
  editingId.value = null
  showForm.value = false
  submitError.value = ''
  formErrors.value = {}
}

function openCreateForm() {
  resetForm()
  showForm.value = true
}

function openEditForm(template: RecurringExpenseTemplate) {
  const values: RecurringExpenseFormValues = {
    vendorId: template.vendorId,
    categoryId: template.categoryId ?? '',
    description: template.description,
    amount: Number(template.amount),
    frequency: template.frequency,
    nextDueDate: template.nextDueDate.slice(0, 10),
    notes: template.notes ?? '',
  }

  baseline.value = { ...values }
  form.value = { ...values }
  editingId.value = template.id
  showForm.value = true
  submitError.value = ''
  formErrors.value = {}
  actionError.value = ''
}

function normalizePayload(values: RecurringExpenseFormValues): RecurringExpensePayload {
  return {
    vendorId: values.vendorId,
    categoryId: values.categoryId || undefined,
    description: values.description,
    amount: values.amount,
    frequency: values.frequency,
    nextDueDate: values.nextDueDate,
    notes: values.notes || undefined,
  }
}

function normalizeError(err: unknown) {
  if (err instanceof ApiError) {
    if (err.content) {
      formErrors.value = err.content
    } else {
      submitError.value = err.message
    }
    return
  }

  if (err instanceof ZodError) {
    formErrors.value = mapZodErrors(err.issues)
    return
  }

  submitError.value = 'Something went wrong'
}

function validatedItems(items: unknown[]) {
  return items
    .map((template) => recurringExpenseTemplateSchema.safeParse(template))
    .filter((result) => result.success)
    .map((result) => result.data)
}

async function fetchValidatedPage() {
  const requestedPage = readPageQuery()
  const response = await fetchRecurringExpenses({ page: requestedPage, pageSize: PAGE_SIZE })
  const lastPage = Math.max(response.pagination.totalPages, 1)

  if (requestedPage > lastPage) {
    await changePage(lastPage)
    return
  }

  return {
    items: validatedItems(response.items),
    pagination: response.pagination,
  }
}

async function loadPage() {
  try {
    error.value = ''
    const [page, rawVendors, rawCategories] = await Promise.all([
      fetchValidatedPage(),
      fetchVendors(),
      fetchExpenseCategories(),
    ])

    if (page) {
      templates.value = page.items
      pagination.value = page.pagination
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
    error.value = err instanceof ApiError ? err.message : 'Something went wrong'
  } finally {
    loading.value = false
  }
}

async function reloadPage() {
  try {
    error.value = ''
    const page = await fetchValidatedPage()
    if (page) {
      templates.value = page.items
      pagination.value = page.pagination
    }
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Something went wrong'
  } finally {
    loading.value = false
  }
}

async function loadFirstPage() {
  if (route.query.page !== undefined) {
    await changePage(1)
    return
  }

  loading.value = true
  await reloadPage()
}

async function submitForm() {
  submitError.value = ''
  formErrors.value = {}
  actionError.value = ''
  submitting.value = true

  try {
    const values = recurringExpenseFormSchema.parse(form.value)
    const payload = normalizePayload(values)

    if (!editingId.value) {
      recurringExpenseTemplateSchema.parse(await createRecurringExpense(payload))
      await loadFirstPage()
    } else if (JSON.stringify(form.value) !== JSON.stringify(baseline.value)) {
      recurringExpenseTemplateSchema.parse(
        await updateRecurringExpense(editingId.value, {
          ...payload,
          categoryId: payload.categoryId ?? null,
          notes: payload.notes ?? null,
        }),
      )
      await reloadPage()
    }

    resetForm()
  } catch (err) {
    normalizeError(err)
  } finally {
    submitting.value = false
  }
}

async function archive(template: RecurringExpenseTemplate) {
  actionError.value = ''
  if (!confirm('Are you sure you want to archive this recurring expense?')) return

  try {
    recurringExpenseRecordSchema.parse(await archiveRecurringExpense(template.id))
    loading.value = true
    await reloadPage()
  } catch (err) {
    actionError.value = err instanceof ApiError ? err.message : 'Archiving recurring expense failed'
  }
}

function isDue(template: RecurringExpenseTemplate) {
  return new Date(template.nextDueDate).getTime() <= Date.now()
}

async function generate(template: RecurringExpenseTemplate) {
  actionError.value = ''
  generatingId.value = template.id

  try {
    expenseSchema.parse(await generateRecurringExpense(template.id))
    await reloadPage()
  } catch (err) {
    actionError.value =
      err instanceof ApiError ? err.message : 'Generating recurring expense failed'
  } finally {
    generatingId.value = null
  }
}

watch(
  () => readPageQuery(),
  () => {
    loading.value = true
    void reloadPage()
  },
)

onMounted(loadPage)
</script>

<template>
  <section class="space-y-8">
    <header class="space-y-3">
      <p class="text-xs font-semibold uppercase tracking-[0.24em] text-stone-400">
        Recurring expenses
      </p>

      <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 class="text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">
            Recurring expenses
          </h2>
          <p class="mt-2 max-w-2xl text-sm leading-6 text-stone-500 sm:text-base">
            Schedule repeatable expenses and generate each due occurrence when it is ready.
          </p>
        </div>

        <button
          v-if="!showForm"
          type="button"
          class="inline-flex items-center justify-center rounded-2xl bg-stone-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-stone-700"
          @click="openCreateForm"
        >
          Add recurring expense
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

    <section v-if="showForm" class="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
      <h3 class="text-lg font-semibold tracking-tight text-stone-900">
        {{ editingId ? 'Edit recurring expense' : 'Create recurring expense' }}
      </h3>

      <form aria-label="Recurring expense form" class="mt-6 space-y-5" @submit.prevent="submitForm">
        <div class="grid gap-4 sm:grid-cols-2">
          <label class="block">
            <span class="mb-2 block text-sm font-medium text-stone-700">Vendor</span>
            <select
              id="recurring-vendor"
              v-model="form.vendorId"
              :aria-describedby="formErrors.vendorId ? 'recurring-vendor-error' : undefined"
              :aria-invalid="Boolean(formErrors.vendorId)"
              class="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-stone-900"
            >
              <option value="">Select vendor</option>
              <option v-for="vendor in vendors" :key="vendor.id" :value="vendor.id">
                {{ vendor.name }}
              </option>
            </select>
            <p
              v-if="formErrors.vendorId"
              id="recurring-vendor-error"
              class="ml-3 mt-2 text-sm text-red-600"
            >
              {{ formErrors.vendorId }}
            </p>
          </label>

          <label class="block">
            <span class="mb-2 block text-sm font-medium text-stone-700">Category</span>
            <select
              id="recurring-category"
              v-model="form.categoryId"
              :aria-describedby="formErrors.categoryId ? 'recurring-category-error' : undefined"
              :aria-invalid="Boolean(formErrors.categoryId)"
              class="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-stone-900"
            >
              <option value="">No category</option>
              <option v-for="category in categories" :key="category.id" :value="category.id">
                {{ category.name }}
              </option>
            </select>
            <p
              v-if="formErrors.categoryId"
              id="recurring-category-error"
              class="ml-3 mt-2 text-sm text-red-600"
            >
              {{ formErrors.categoryId }}
            </p>
          </label>

          <label class="block sm:col-span-2">
            <span class="mb-2 block text-sm font-medium text-stone-700">Description</span>
            <input
              id="recurring-description"
              v-model="form.description"
              type="text"
              maxlength="240"
              :aria-describedby="formErrors.description ? 'recurring-description-error' : undefined"
              :aria-invalid="Boolean(formErrors.description)"
              class="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-stone-900"
            />
            <p
              v-if="formErrors.description"
              id="recurring-description-error"
              class="ml-3 mt-2 text-sm text-red-600"
            >
              {{ formErrors.description }}
            </p>
          </label>

          <label class="block">
            <span class="mb-2 block text-sm font-medium text-stone-700">Amount</span>
            <input
              id="recurring-amount"
              v-model.number="form.amount"
              type="number"
              min="0.01"
              step="0.01"
              :aria-describedby="formErrors.amount ? 'recurring-amount-error' : undefined"
              :aria-invalid="Boolean(formErrors.amount)"
              class="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-stone-900"
            />
            <p
              v-if="formErrors.amount"
              id="recurring-amount-error"
              class="ml-3 mt-2 text-sm text-red-600"
            >
              {{ formErrors.amount }}
            </p>
          </label>

          <label class="block">
            <span class="mb-2 block text-sm font-medium text-stone-700">Frequency</span>
            <select
              id="recurring-frequency"
              v-model="form.frequency"
              :aria-describedby="formErrors.frequency ? 'recurring-frequency-error' : undefined"
              :aria-invalid="Boolean(formErrors.frequency)"
              class="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-stone-900"
            >
              <option value="WEEKLY">Weekly</option>
              <option value="MONTHLY">Monthly</option>
              <option value="YEARLY">Yearly</option>
            </select>
            <p
              v-if="formErrors.frequency"
              id="recurring-frequency-error"
              class="ml-3 mt-2 text-sm text-red-600"
            >
              {{ formErrors.frequency }}
            </p>
          </label>

          <label class="block">
            <span class="mb-2 block text-sm font-medium text-stone-700">Next due date</span>
            <input
              id="recurring-next-due-date"
              v-model="form.nextDueDate"
              type="date"
              :aria-describedby="
                formErrors.nextDueDate ? 'recurring-next-due-date-error' : undefined
              "
              :aria-invalid="Boolean(formErrors.nextDueDate)"
              class="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-stone-900"
            />
            <p
              v-if="formErrors.nextDueDate"
              id="recurring-next-due-date-error"
              class="ml-3 mt-2 text-sm text-red-600"
            >
              {{ formErrors.nextDueDate }}
            </p>
          </label>

          <label class="block sm:col-span-2">
            <span class="mb-2 block text-sm font-medium text-stone-700">Notes</span>
            <textarea
              id="recurring-notes"
              v-model="form.notes"
              rows="3"
              maxlength="1000"
              :aria-describedby="formErrors.notes ? 'recurring-notes-error' : undefined"
              :aria-invalid="Boolean(formErrors.notes)"
              class="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-stone-900"
            />
            <p
              v-if="formErrors.notes"
              id="recurring-notes-error"
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
            class="rounded-2xl px-4 py-3 text-sm font-medium text-stone-600 hover:bg-stone-100"
            @click="resetForm"
          >
            Cancel
          </button>
          <button
            type="submit"
            :disabled="submitting"
            class="rounded-2xl bg-stone-900 px-4 py-3 text-sm font-medium text-white hover:bg-stone-700 disabled:cursor-not-allowed disabled:bg-stone-400"
          >
            {{ submitting ? 'Saving...' : 'Save recurring expense' }}
          </button>
        </div>
      </form>
    </section>

    <section class="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
      <div v-if="loading" role="status" aria-label="Loading recurring expenses" class="space-y-3">
        <div class="h-16 animate-pulse rounded-2xl bg-stone-100"></div>
        <div class="h-16 animate-pulse rounded-2xl bg-stone-100"></div>
      </div>

      <div
        v-else-if="error"
        role="alert"
        class="rounded-2xl border border-red-200 bg-red-50 px-4 py-5 text-sm text-red-700"
      >
        <p class="font-medium">Could not load recurring expenses</p>
        <p class="mt-1">{{ error }}</p>
      </div>

      <div
        v-else-if="templates.length === 0"
        class="rounded-2xl border border-dashed border-stone-200 bg-stone-50 px-5 py-12 text-center"
      >
        <p class="text-base font-medium text-stone-700">No recurring expenses yet</p>
      </div>

      <div v-else class="space-y-3">
        <article
          v-for="template in templates"
          :key="template.id"
          class="rounded-2xl border border-stone-200 bg-stone-50 px-5 py-4"
        >
          <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <h3 class="text-base font-semibold tracking-tight text-stone-900">
                  {{ template.description }}
                </h3>
                <span
                  v-if="isDue(template)"
                  class="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800"
                  >Due</span
                >
              </div>
              <div class="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-stone-500">
                <span>{{ template.vendor.name }}</span>
                <span>{{ template.category?.name ?? 'No category' }}</span>
                <span>{{ template.frequency.toLowerCase() }}</span>
                <span>Next {{ formatDate(template.nextDueDate) }}</span>
              </div>
              <p v-if="template.notes" class="mt-2 text-sm text-stone-500">{{ template.notes }}</p>
            </div>

            <div class="flex flex-wrap items-center gap-2">
              <span class="mr-1 text-sm font-semibold text-stone-900"
                >{{ formatAmount(template.amount) }} {{ template.currency }}</span
              >
              <button
                type="button"
                :disabled="!isDue(template) || generatingId === template.id"
                class="rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm font-medium text-emerald-700 hover:border-emerald-300 disabled:cursor-not-allowed disabled:text-stone-300"
                @click="generate(template)"
              >
                {{ generatingId === template.id ? 'Generating...' : 'Generate' }}
              </button>
              <button
                type="button"
                class="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-600 hover:border-stone-300"
                @click="openEditForm(template)"
              >
                Edit
              </button>
              <button
                type="button"
                class="rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:border-red-300"
                @click="archive(template)"
              >
                Archive
              </button>
            </div>
          </div>
        </article>

        <nav
          v-if="pagination.totalPages > 1"
          aria-label="Recurring expense pagination"
          class="flex flex-col gap-3 border-t border-stone-200 pt-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <p class="text-sm text-stone-500">
            Page {{ pagination.page }} of {{ pagination.totalPages }} ·
            {{ pagination.totalItems }} recurring expenses
          </p>
          <div class="flex items-center gap-2">
            <button
              type="button"
              :disabled="pagination.page === 1"
              class="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-600 disabled:cursor-not-allowed disabled:text-stone-300"
              @click="changePage(pagination.page - 1)"
            >
              Previous
            </button>
            <button
              type="button"
              :disabled="pagination.page === pagination.totalPages"
              class="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-600 disabled:cursor-not-allowed disabled:text-stone-300"
              @click="changePage(pagination.page + 1)"
            >
              Next
            </button>
          </div>
        </nav>
      </div>
    </section>
  </section>
</template>
