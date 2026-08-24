<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ZodError } from 'zod'
import {
  Archive,
  ChevronLeft,
  ChevronRight,
  EllipsisVertical,
  Palette,
  Pencil,
  Plus,
  Tags,
} from '@lucide/vue'
import { ApiError } from '@/lib/api'
import { mapZodErrors } from '@/lib/zod'
import {
  archiveExpenseCategory,
  createExpenseCategory,
  fetchExpenseCategoriesPage,
  updateExpenseCategory,
} from '@/lib/expense-categories/api'
import {
  expenseCategoryFormSchema,
  expenseCategorySchema,
  type ExpenseCategory,
  type ExpenseCategoryFormValues,
} from '@/lib/expense-categories/schema'
import RecordActionSheet, { type RecordActionItem } from '@/components/ui/RecordActionSheet.vue'
import ResponsiveFormSurface from '@/components/ui/ResponsiveFormSurface.vue'

const categories = ref<ExpenseCategory[]>([])
const PAGE_SIZE = 6
const route = useRoute()
const router = useRouter()
const pagination = ref({
  page: 1,
  pageSize: PAGE_SIZE,
  totalItems: 0,
  totalPages: 0,
})
const loading = ref(true)
const error = ref('')
const actionError = ref('')
const showForm = ref(false)
const editingId = ref<string | null>(null)
const submitting = ref(false)
const submitError = ref('')
const formErrors = ref<Record<string, string>>({})
const mobileActionsOpen = ref(false)
const activeActionCategory = ref<ExpenseCategory | null>(null)

const baseline = ref<ExpenseCategoryFormValues>({
  name: '',
  color: '#64748b',
})

const form = ref<ExpenseCategoryFormValues>({
  name: '',
  color: '#64748b',
})

const mobileCategoryActions = [
  { id: 'edit', label: 'Edit category', icon: Pencil },
  { id: 'archive', label: 'Archive category', icon: Archive, tone: 'danger' },
] as const satisfies readonly RecordActionItem[]

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
  baseline.value = { name: '', color: '#64748b' }
  form.value = { name: '', color: '#64748b' }
  editingId.value = null
  showForm.value = false
  submitError.value = ''
  formErrors.value = {}
}

function openCreateForm() {
  resetForm()
  showForm.value = true
}

function openEditForm(category: ExpenseCategory) {
  const normalized = {
    name: category.name,
    color: category.color ?? '#64748b',
  }
  baseline.value = { ...normalized }
  form.value = { ...normalized }
  editingId.value = category.id
  showForm.value = true
  submitError.value = ''
  formErrors.value = {}
  actionError.value = ''
}

function updateFormOpen(open: boolean) {
  if (!open) {
    resetForm()
  }
}

function openMobileActions(category: ExpenseCategory) {
  activeActionCategory.value = category
  mobileActionsOpen.value = true
}

function handleMobileAction(actionId: string) {
  const category = activeActionCategory.value
  if (!category) return

  mobileActionsOpen.value = false
  activeActionCategory.value = null

  if (actionId === 'edit') {
    openEditForm(category)
  } else if (actionId === 'archive') {
    void archive(category)
  }
}

function normalizePayload(input: ExpenseCategoryFormValues): ExpenseCategoryFormValues {
  return {
    name: input.name,
    color: input.color || undefined,
  }
}

function isSameForm(left: ExpenseCategoryFormValues, right: ExpenseCategoryFormValues) {
  return left.name === right.name && (left.color ?? '') === (right.color ?? '')
}

function normalizeError(err: unknown) {
  if (err instanceof ApiError) {
    if (err.content) {
      formErrors.value = err.content
      return
    }
    submitError.value = err.message
    return
  }

  if (err instanceof ZodError) {
    formErrors.value = mapZodErrors(err.issues)
    return
  }

  submitError.value = 'Something went wrong'
}

async function loadCategoriesPage() {
  try {
    error.value = ''
    const requestedPage = readPageQuery()
    const response = await fetchExpenseCategoriesPage({
      page: requestedPage,
      pageSize: PAGE_SIZE,
    })
    const lastPage = Math.max(response.pagination.totalPages, 1)
    if (requestedPage > lastPage) {
      await changePage(lastPage)
      return
    }

    const validated: ExpenseCategory[] = []

    for (const category of response.items) {
      const result = expenseCategorySchema.safeParse(category)
      if (result.success) {
        validated.push(result.data)
      }
    }

    categories.value = validated
    pagination.value = response.pagination
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
  await loadCategoriesPage()
}

async function submitForm() {
  submitError.value = ''
  formErrors.value = {}
  actionError.value = ''
  submitting.value = true

  try {
    const validation = expenseCategoryFormSchema.parse(form.value)
    const payload = normalizePayload(validation)

    if (!editingId.value) {
      const result = expenseCategorySchema.safeParse(await createExpenseCategory(payload))
      if (!result.success) {
        resetForm()
        actionError.value = 'Failed to fetch created category'
        return
      }
      await loadFirstPage()
    } else if (!isSameForm(payload, baseline.value)) {
      const result = expenseCategorySchema.safeParse(
        await updateExpenseCategory(editingId.value, payload),
      )
      if (!result.success) {
        resetForm()
        actionError.value = 'Failed to fetch updated category'
        return
      }

      const updated = result.data
      categories.value = categories.value.map((category) =>
        category.id === updated.id ? updated : category,
      )
    }

    resetForm()
  } catch (err) {
    normalizeError(err)
  } finally {
    submitting.value = false
  }
}

async function archive(category: ExpenseCategory) {
  actionError.value = ''

  try {
    if (!confirm('Are you sure you want to archive this category?')) {
      return
    }

    expenseCategorySchema.parse(await archiveExpenseCategory(category.id))
    loading.value = true
    await loadCategoriesPage()
  } catch (err) {
    actionError.value = err instanceof ApiError ? err.message : 'Archiving category failed'
  }
}

watch(
  () => readPageQuery(),
  () => {
    loading.value = true
    void loadCategoriesPage()
  },
)

onMounted(loadCategoriesPage)
</script>

<template>
  <section class="min-w-0 space-y-7">
    <header class="space-y-4">
      <div class="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p class="text-xs font-semibold uppercase tracking-[0.24em] text-accent">Organization</p>
          <h2 class="mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Expense categories
          </h2>
          <p class="mt-2 max-w-2xl text-sm leading-6 text-ink-muted sm:text-base">
            Build a simple, recognizable system for understanding where money goes.
          </p>
        </div>

        <button
          v-if="!showForm"
          type="button"
          class="inline-flex min-h-11 w-fit items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-white shadow-card transition hover:bg-brand-strong max-[375px]:w-full"
          @click="openCreateForm"
        >
          <Plus :size="17" aria-hidden="true" />
          Add category
        </button>
      </div>

      <div
        v-if="actionError"
        role="alert"
        class="rounded-2xl border border-danger/25 bg-danger-soft px-4 py-3 text-sm text-danger"
      >
        {{ actionError }}
      </div>
    </header>

    <div v-if="showForm" data-category-form-panel>
      <ResponsiveFormSurface
        :open="showForm"
        :eyebrow="editingId ? 'Revise category' : 'New category'"
        :title="editingId ? 'Edit category' : 'Create category'"
        description="Choose a clear name and a recognizable color."
        @update:open="updateFormOpen"
      >
        <template #icon>
          <Pencil v-if="editingId" :size="18" aria-hidden="true" />
          <Plus v-else :size="18" aria-hidden="true" />
        </template>

        <form aria-label="Category form" class="space-y-5" @submit.prevent="submitForm">
          <div class="grid gap-4 sm:grid-cols-[1fr_10rem]">
            <label class="block">
              <span class="mb-1.5 block text-sm font-medium text-ink">Name</span>
              <input
                id="category-name"
                v-model="form.name"
                type="text"
                maxlength="120"
                :aria-describedby="formErrors.name ? 'category-name-error' : undefined"
                :aria-invalid="Boolean(formErrors.name)"
                :class="[
                  'min-h-11 w-full rounded-xl border bg-surface px-3 py-2 text-sm text-ink outline-none transition',
                  formErrors.name
                    ? 'border-danger focus:border-danger'
                    : 'border-line hover:border-line-strong focus:border-brand',
                ]"
              />
              <p
                v-if="formErrors.name"
                id="category-name-error"
                class="ml-3 mt-2 text-sm text-danger"
              >
                {{ formErrors.name }}
              </p>
            </label>

            <label class="block">
              <span class="mb-1.5 block text-sm font-medium text-ink">Color</span>
              <span
                class="flex min-h-11 items-center gap-2 rounded-xl border border-line bg-surface px-2"
              >
                <input
                  id="category-color"
                  v-model="form.color"
                  type="color"
                  :aria-describedby="formErrors.color ? 'category-color-error' : undefined"
                  :aria-invalid="Boolean(formErrors.color)"
                  class="size-8 cursor-pointer rounded-lg border-0 bg-transparent p-0"
                />
                <span class="font-mono text-xs uppercase text-ink-muted">{{ form.color }}</span>
              </span>
              <p
                v-if="formErrors.color"
                id="category-color-error"
                class="ml-3 mt-2 text-sm text-danger"
              >
                {{ formErrors.color }}
              </p>
            </label>
          </div>

          <div
            v-if="submitError"
            role="alert"
            class="rounded-2xl border border-danger/25 bg-danger-soft px-4 py-3 text-sm text-danger"
          >
            {{ submitError }}
          </div>

          <div
            class="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3"
          >
            <button
              type="button"
              class="min-h-11 w-full rounded-xl px-4 text-sm font-medium text-ink-muted transition hover:bg-surface-muted hover:text-ink sm:w-auto"
              @click="resetForm"
            >
              Cancel
            </button>

            <button
              type="submit"
              :disabled="submitting"
              class="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-brand px-4 text-sm font-semibold text-white transition hover:bg-brand-strong disabled:cursor-not-allowed disabled:bg-line-strong sm:w-auto"
            >
              {{ submitting ? 'Saving...' : 'Save category' }}
            </button>
          </div>
        </form>
      </ResponsiveFormSurface>
    </div>

    <section class="min-w-0 overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
      <header class="border-b border-line px-5 py-4 sm:px-6">
        <h3 class="text-base font-semibold text-ink">Active categories</h3>
        <p class="mt-0.5 text-xs text-ink-muted">
          {{ pagination.totalItems }} categor{{ pagination.totalItems === 1 ? 'y' : 'ies' }}
          available for expenses
        </p>
      </header>

      <div
        v-if="loading"
        class="space-y-3 p-5 sm:p-6"
        role="status"
        aria-label="Loading categories"
      >
        <div class="h-4 w-36 animate-pulse rounded bg-surface-muted"></div>
        <div class="grid gap-3 sm:grid-cols-2">
          <div class="h-28 animate-pulse rounded-2xl bg-surface-muted"></div>
          <div class="h-28 animate-pulse rounded-2xl bg-surface-muted"></div>
        </div>
      </div>

      <div
        v-else-if="error"
        role="alert"
        class="m-5 rounded-2xl border border-danger/25 bg-danger-soft px-4 py-5 text-sm text-danger sm:m-6"
      >
        <p class="font-medium">Could not load categories</p>
        <p class="mt-1">{{ error }}</p>
      </div>

      <div v-else-if="categories.length === 0" class="px-5 py-14 text-center sm:px-6">
        <span
          class="mx-auto flex size-12 items-center justify-center rounded-2xl bg-accent-soft text-accent"
        >
          <Palette :size="22" :stroke-width="1.7" aria-hidden="true" />
        </span>
        <p class="mt-4 text-base font-semibold text-ink">No categories yet</p>
        <p class="mx-auto mt-1 max-w-sm text-sm leading-6 text-ink-muted">
          Create your first category to make spending patterns easier to recognize.
        </p>
        <button
          type="button"
          class="mt-5 inline-flex min-h-10 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-white transition hover:bg-brand-strong"
          @click="openCreateForm"
        >
          <Plus :size="16" aria-hidden="true" />
          Create first category
        </button>
      </div>

      <div v-else class="grid gap-3 p-5 sm:grid-cols-2 sm:p-6 xl:grid-cols-3">
        <article
          v-for="category in categories"
          :key="category.id"
          class="relative overflow-hidden rounded-2xl border border-line bg-surface p-4 transition hover:-translate-y-0.5 hover:border-line-strong hover:shadow-card"
        >
          <span
            class="absolute inset-x-0 top-0 h-1 bg-line-strong"
            :style="{ backgroundColor: category.color ?? undefined }"
            aria-hidden="true"
          />
          <div class="flex min-w-0 items-center gap-3 pt-1 pr-12 sm:pr-0">
            <span
              class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-muted"
            >
              <span
                class="size-4 rounded-full bg-line-strong ring-2 ring-surface shadow-sm"
                :style="{ backgroundColor: category.color ?? undefined }"
              />
            </span>
            <div class="min-w-0">
              <h4 class="truncate text-sm font-semibold text-ink sm:text-base">
                {{ category.name }}
              </h4>
              <p class="mt-0.5 flex items-center gap-1 text-xs text-ink-muted">
                <Tags :size="12" aria-hidden="true" />
                Expense category
              </p>
            </div>
          </div>

          <div class="mt-5 flex items-center justify-end gap-2 border-t border-line pt-3">
            <button
              type="button"
              class="hidden min-h-11 min-w-11 items-center justify-center rounded-xl bg-surface-muted px-2.5 text-ink-muted transition hover:bg-surface-muted hover:text-ink sm:inline-flex"
              :aria-label="`Edit ${category.name}`"
              title="Edit category"
              @click="openEditForm(category)"
            >
              <Pencil :size="17" :stroke-width="1.8" aria-hidden="true" />
            </button>

            <button
              type="button"
              class="hidden min-h-11 min-w-11 items-center justify-center rounded-xl bg-danger-soft px-2.5 text-danger transition hover:bg-danger hover:text-white sm:inline-flex"
              :aria-label="`Archive ${category.name}`"
              title="Archive category"
              @click="archive(category)"
            >
              <Archive :size="17" :stroke-width="1.8" aria-hidden="true" />
            </button>
            <button
              type="button"
              data-mobile-category-actions
              class="absolute right-4 top-4 inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-surface px-2.5 text-ink-muted transition hover:bg-surface-muted hover:text-ink sm:hidden"
              :aria-label="`Actions for ${category.name}`"
              @click="openMobileActions(category)"
            >
              <EllipsisVertical :size="18" aria-hidden="true" />
            </button>
          </div>
        </article>
      </div>

      <nav
        v-if="!loading && !error && pagination.totalPages > 1"
        aria-label="Expense category pagination"
        class="flex flex-col gap-3 border-t border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"
      >
        <p class="text-sm text-ink-muted">
          Page {{ pagination.page }} of {{ pagination.totalPages }} ·
          {{ pagination.totalItems }} categories
        </p>

        <div class="flex items-center gap-2">
          <button
            type="button"
            :disabled="pagination.page === 1"
            class="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-line bg-surface px-3 text-sm font-medium text-ink-muted transition hover:border-line-strong hover:text-ink disabled:cursor-not-allowed disabled:text-line-strong"
            @click="changePage(pagination.page - 1)"
          >
            <ChevronLeft :size="15" aria-hidden="true" />
            Previous
          </button>
          <button
            type="button"
            :disabled="pagination.page === pagination.totalPages"
            class="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-line bg-surface px-3 text-sm font-medium text-ink-muted transition hover:border-line-strong hover:text-ink disabled:cursor-not-allowed disabled:text-line-strong"
            @click="changePage(pagination.page + 1)"
          >
            Next
            <ChevronRight :size="15" aria-hidden="true" />
          </button>
        </div>
      </nav>
    </section>

    <RecordActionSheet
      :open="mobileActionsOpen"
      :record-label="activeActionCategory?.name ?? 'category'"
      :actions="mobileCategoryActions"
      @update:open="mobileActionsOpen = $event"
      @select="handleMobileAction"
    />
  </section>
</template>
