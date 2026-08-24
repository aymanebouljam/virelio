<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ZodError } from 'zod'
import {
  Archive,
  CalendarClock,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Ellipsis,
  Pencil,
  Play,
  Plus,
  Repeat2,
  Store,
  Tags,
} from '@lucide/vue'
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
import RecordActionSheet, { type RecordActionItem } from '@/components/ui/RecordActionSheet.vue'
import ResponsiveFormSurface from '@/components/ui/ResponsiveFormSurface.vue'

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
const mobileActionsOpen = ref(false)
const activeActionTemplate = ref<RecurringExpenseTemplate | null>(null)
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

function updateFormOpen(open: boolean) {
  if (!open) {
    resetForm()
  }
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

function openMobileActions(template: RecurringExpenseTemplate) {
  activeActionTemplate.value = template
  mobileActionsOpen.value = true
}

function updateMobileActionsOpen(open: boolean) {
  mobileActionsOpen.value = open
}

function handleMobileAction(actionId: string) {
  const template = activeActionTemplate.value
  if (!template) return

  mobileActionsOpen.value = false
  activeActionTemplate.value = null

  if (actionId === 'generate') {
    void generate(template)
  } else if (actionId === 'edit') {
    openEditForm(template)
  } else if (actionId === 'archive') {
    void archive(template)
  }
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

const mobileRecurringActions = computed<readonly RecordActionItem[]>(() => {
  const template = activeActionTemplate.value

  return [
    {
      id: 'generate',
      label: generatingId.value === template?.id ? 'Generating...' : 'Generate expense',
      icon: Play,
      disabled: !template || !isDue(template) || generatingId.value === template.id,
    },
    { id: 'edit', label: 'Edit schedule', icon: Pencil },
    { id: 'archive', label: 'Archive schedule', icon: Archive, tone: 'danger' },
  ]
})

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
  <section class="space-y-6">
    <header class="space-y-4 border-b border-line pb-6">
      <div class="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
            Repeat-cost schedule
          </p>
          <h1
            class="font-display mt-2 text-[2rem] font-semibold leading-tight tracking-[-0.035em] text-ink sm:text-[2.5rem]"
          >
            Know what comes due next.
          </h1>
          <p class="mt-2 max-w-2xl text-sm leading-6 text-ink-muted sm:text-[15px]">
            Maintain repeat costs and turn each due schedule into an expense when the record is
            ready.
          </p>
        </div>

        <button
          v-if="!showForm"
          type="button"
          class="inline-flex min-h-11 w-fit items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-white transition hover:bg-brand-strong"
          @click="openCreateForm"
        >
          <Plus :size="17" aria-hidden="true" />
          Add recurring expense
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

    <div v-if="showForm" data-recurring-expense-form-panel>
      <ResponsiveFormSurface
        :open="showForm"
        :eyebrow="editingId ? 'Revise schedule' : 'New schedule'"
        :title="editingId ? 'Edit recurring expense' : 'Create recurring expense'"
        description="Define the cost, cadence, and next expected date."
        @update:open="updateFormOpen"
      >
        <template #icon>
          <Pencil v-if="editingId" :size="18" aria-hidden="true" />
          <Plus v-else :size="18" aria-hidden="true" />
        </template>

        <form aria-label="Recurring expense form" class="space-y-5" @submit.prevent="submitForm">
          <div class="grid gap-4 sm:grid-cols-2">
            <label class="block">
              <span class="mb-1.5 block text-sm font-medium text-ink">Vendor</span>
              <select
                id="recurring-vendor"
                v-model="form.vendorId"
                :aria-describedby="formErrors.vendorId ? 'recurring-vendor-error' : undefined"
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
                id="recurring-vendor-error"
                class="mt-1.5 text-sm text-danger"
              >
                {{ formErrors.vendorId }}
              </p>
            </label>

            <label class="block">
              <span class="mb-1.5 block text-sm font-medium text-ink">Category</span>
              <select
                id="recurring-category"
                v-model="form.categoryId"
                :aria-describedby="formErrors.categoryId ? 'recurring-category-error' : undefined"
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
                id="recurring-category-error"
                class="mt-1.5 text-sm text-danger"
              >
                {{ formErrors.categoryId }}
              </p>
            </label>

            <label class="block sm:col-span-2">
              <span class="mb-1.5 block text-sm font-medium text-ink">Description</span>
              <input
                id="recurring-description"
                v-model="form.description"
                type="text"
                maxlength="240"
                :aria-describedby="
                  formErrors.description ? 'recurring-description-error' : undefined
                "
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
                id="recurring-description-error"
                class="mt-1.5 text-sm text-danger"
              >
                {{ formErrors.description }}
              </p>
            </label>

            <label class="block">
              <span class="mb-1.5 block text-sm font-medium text-ink">Amount</span>
              <input
                id="recurring-amount"
                v-model.number="form.amount"
                type="number"
                inputmode="decimal"
                min="0.01"
                step="0.01"
                :aria-describedby="formErrors.amount ? 'recurring-amount-error' : undefined"
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
                id="recurring-amount-error"
                class="mt-1.5 text-sm text-danger"
              >
                {{ formErrors.amount }}
              </p>
            </label>

            <label class="block">
              <span class="mb-1.5 block text-sm font-medium text-ink">Frequency</span>
              <select
                id="recurring-frequency"
                v-model="form.frequency"
                :aria-describedby="formErrors.frequency ? 'recurring-frequency-error' : undefined"
                :aria-invalid="Boolean(formErrors.frequency)"
                :class="[
                  'min-h-11 w-full rounded-lg border bg-surface-raised px-3 py-2 text-sm text-ink outline-none transition focus:bg-surface',
                  formErrors.frequency
                    ? 'border-danger/45 focus:border-danger'
                    : 'border-line hover:border-line-strong focus:border-brand',
                ]"
              >
                <option value="WEEKLY">Weekly</option>
                <option value="MONTHLY">Monthly</option>
                <option value="YEARLY">Yearly</option>
              </select>
              <p
                v-if="formErrors.frequency"
                id="recurring-frequency-error"
                class="mt-1.5 text-sm text-danger"
              >
                {{ formErrors.frequency }}
              </p>
            </label>

            <label class="block">
              <span class="mb-1.5 block text-sm font-medium text-ink">Next due date</span>
              <input
                id="recurring-next-due-date"
                v-model="form.nextDueDate"
                type="date"
                :aria-describedby="
                  formErrors.nextDueDate ? 'recurring-next-due-date-error' : undefined
                "
                :aria-invalid="Boolean(formErrors.nextDueDate)"
                :class="[
                  'min-h-11 w-full rounded-lg border bg-surface-raised px-3 py-2 text-sm text-ink outline-none transition focus:bg-surface',
                  formErrors.nextDueDate
                    ? 'border-danger/45 focus:border-danger'
                    : 'border-line hover:border-line-strong focus:border-brand',
                ]"
              />
              <p
                v-if="formErrors.nextDueDate"
                id="recurring-next-due-date-error"
                class="mt-1.5 text-sm text-danger"
              >
                {{ formErrors.nextDueDate }}
              </p>
            </label>

            <label class="block sm:col-span-2">
              <span class="mb-1.5 block text-sm font-medium text-ink">Notes</span>
              <textarea
                id="recurring-notes"
                v-model="form.notes"
                rows="3"
                maxlength="1000"
                :aria-describedby="formErrors.notes ? 'recurring-notes-error' : undefined"
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
                id="recurring-notes-error"
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
              class="min-h-11 w-full rounded-lg bg-brand px-4 text-sm font-semibold text-white transition hover:bg-brand-strong disabled:cursor-not-allowed disabled:bg-line-strong sm:w-auto"
            >
              {{ submitting ? 'Saving...' : 'Save recurring expense' }}
            </button>
          </div>
        </form>
      </ResponsiveFormSurface>
    </div>

    <section class="overflow-hidden rounded-xl border border-line bg-surface shadow-card">
      <header class="border-b border-line px-5 py-4 sm:px-6">
        <p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
          Scheduled records
        </p>
        <h2 class="font-display mt-1 text-lg font-semibold tracking-[-0.02em] text-ink">
          Active schedules
        </h2>
        <p class="mt-0.5 text-xs text-ink-muted">
          {{ pagination.totalItems }} recurring expense{{ pagination.totalItems === 1 ? '' : 's' }}
          planned
        </p>
      </header>

      <div
        v-if="loading"
        role="status"
        aria-label="Loading recurring expenses"
        class="space-y-3 p-5 sm:p-6"
      >
        <div class="h-28 animate-pulse rounded-lg bg-surface-muted/70"></div>
        <div class="h-28 animate-pulse rounded-lg bg-surface-muted/70"></div>
      </div>

      <div
        v-else-if="error"
        role="alert"
        class="m-5 rounded-lg border border-danger/25 bg-danger-soft px-4 py-5 text-sm text-danger sm:m-6"
      >
        <p class="font-medium">Could not load recurring expenses</p>
        <p class="mt-1">{{ error }}</p>
      </div>

      <div v-else-if="templates.length === 0" class="px-5 py-14 text-center sm:px-6">
        <span
          class="mx-auto flex size-11 items-center justify-center rounded-lg bg-brand-soft text-brand"
        >
          <Repeat2 :size="22" :stroke-width="1.7" aria-hidden="true" />
        </span>
        <p class="mt-4 text-base font-semibold text-ink">No recurring expenses yet</p>
        <p class="mx-auto mt-1 max-w-sm text-sm leading-6 text-ink-muted">
          Add a repeat cost to keep upcoming obligations visible and predictable.
        </p>
        <button
          type="button"
          class="mt-5 inline-flex min-h-10 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-white transition hover:bg-brand-strong"
          @click="openCreateForm"
        >
          <Plus :size="16" aria-hidden="true" />
          Create first schedule
        </button>
      </div>

      <div v-else>
        <div class="divide-y divide-line">
          <article
            v-for="template in templates"
            :key="template.id"
            data-recurring-expense-record
            class="relative px-5 py-5 transition hover:bg-surface-muted/45 sm:px-6"
          >
            <span
              class="absolute inset-y-0 left-0 w-0.5"
              :class="isDue(template) ? 'bg-accent' : 'bg-line-strong'"
              aria-hidden="true"
            />
            <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div class="flex min-w-0 items-start gap-3.5">
                <span
                  class="flex size-9 shrink-0 items-center justify-center rounded-lg"
                  :class="
                    isDue(template) ? 'bg-accent-soft text-accent' : 'bg-brand-soft text-brand'
                  "
                >
                  <CalendarClock :size="18" :stroke-width="1.8" aria-hidden="true" />
                </span>
                <div class="min-w-0">
                  <div class="flex flex-wrap items-center gap-2">
                    <h4 class="truncate text-sm font-semibold text-ink sm:text-base">
                      {{ template.description }}
                    </h4>
                    <span
                      v-if="isDue(template)"
                      class="border-l-2 border-accent bg-accent-soft/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-accent"
                      >Due</span
                    >
                  </div>
                  <div class="mt-1.5 flex flex-wrap gap-x-3 gap-y-1.5 text-xs text-ink-muted">
                    <span class="inline-flex items-center gap-1.5">
                      <Store :size="13" aria-hidden="true" />
                      {{ template.vendor.name }}
                    </span>
                    <span class="inline-flex items-center gap-1.5">
                      <Tags :size="13" aria-hidden="true" />
                      {{ template.category?.name ?? 'No category' }}
                    </span>
                    <span class="inline-flex items-center gap-1.5 capitalize">
                      <Repeat2 :size="13" aria-hidden="true" />
                      {{ template.frequency.toLowerCase() }}
                    </span>
                    <span class="inline-flex items-center gap-1.5">
                      <CalendarDays :size="13" aria-hidden="true" />
                      Next {{ formatDate(template.nextDueDate) }}
                    </span>
                  </div>
                  <p v-if="template.notes" class="mt-2 line-clamp-2 text-sm text-ink-muted">
                    {{ template.notes }}
                  </p>
                </div>
              </div>

              <div class="flex flex-wrap items-center justify-between gap-2 lg:justify-end">
                <span class="font-figure mr-auto text-base font-semibold text-ink sm:mr-1">
                  {{ formatAmount(template.amount) }} {{ template.currency }}
                </span>
                <button
                  type="button"
                  :disabled="!isDue(template) || generatingId === template.id"
                  class="hidden min-h-10 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-semibold text-white transition hover:bg-brand-strong disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-line-strong md:inline-flex"
                  @click="generate(template)"
                >
                  <Play :size="14" aria-hidden="true" />
                  {{ generatingId === template.id ? 'Generating...' : 'Generate' }}
                </button>
                <button
                  type="button"
                  class="hidden min-h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-ink-muted transition hover:bg-surface-muted hover:text-ink md:inline-flex"
                  @click="openEditForm(template)"
                >
                  <Pencil :size="14" aria-hidden="true" />
                  Edit
                </button>
                <button
                  type="button"
                  class="hidden min-h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-ink-muted transition hover:bg-danger-soft hover:text-danger md:inline-flex"
                  @click="archive(template)"
                >
                  <Archive :size="14" aria-hidden="true" />
                  Archive
                </button>

                <button
                  type="button"
                  data-mobile-recurring-actions
                  class="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-line bg-surface px-2.5 text-ink-muted transition hover:border-line-strong hover:bg-surface-muted hover:text-ink md:hidden"
                  :aria-label="`Actions for ${template.description}`"
                  @click="openMobileActions(template)"
                >
                  <Ellipsis :size="18" aria-hidden="true" />
                </button>
              </div>
            </div>
          </article>
        </div>

        <nav
          v-if="pagination.totalPages > 1"
          aria-label="Recurring expense pagination"
          class="flex flex-col gap-3 border-t border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"
        >
          <p class="text-sm text-ink-muted">
            Page {{ pagination.page }} of {{ pagination.totalPages }} ·
            {{ pagination.totalItems }} recurring expenses
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
      :record-label="activeActionTemplate?.description ?? 'recurring expense'"
      :actions="mobileRecurringActions"
      @update:open="updateMobileActionsOpen"
      @select="handleMobileAction"
    />
  </section>
</template>
