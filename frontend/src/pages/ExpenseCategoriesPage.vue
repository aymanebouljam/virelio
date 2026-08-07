<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ZodError } from 'zod'
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

const baseline = ref<ExpenseCategoryFormValues>({
  name: '',
  color: '#64748b',
})

const form = ref<ExpenseCategoryFormValues>({
  name: '',
  color: '#64748b',
})

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
  <section class="space-y-8">
    <header class="space-y-3">
      <p class="text-xs font-semibold uppercase tracking-[0.24em] text-stone-400">Categories</p>

      <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 class="text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">
            Expense categories
          </h2>
          <p class="mt-2 max-w-2xl text-sm leading-6 text-stone-500 sm:text-base">
            Organize expenses into a manageable set of categories before building expense entry.
          </p>
        </div>

        <div v-if="!showForm">
          <button
            type="button"
            class="inline-flex items-center justify-center rounded-2xl bg-stone-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-stone-700"
            @click="openCreateForm"
          >
            Add category
          </button>
        </div>
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
        {{ editingId ? 'Edit category' : 'Create category' }}
      </h3>

      <form aria-label="Category form" class="mt-6 space-y-5" @submit.prevent="submitForm">
        <div class="grid gap-4 sm:grid-cols-[1fr_auto]">
          <label class="block">
            <span class="mb-2 block text-sm font-medium text-stone-700">Name</span>
            <input
              id="category-name"
              v-model="form.name"
              type="text"
              maxlength="120"
              :aria-describedby="formErrors.name ? 'category-name-error' : undefined"
              :aria-invalid="Boolean(formErrors.name)"
              :class="[
                'w-full rounded-2xl border bg-white px-4 py-3 text-sm text-stone-900 outline-none transition',
                formErrors.name
                  ? 'border-red-300 focus:border-red-500'
                  : 'border-stone-300 focus:border-stone-900',
              ]"
            />
            <p
              v-if="formErrors.name"
              id="category-name-error"
              class="ml-3 mt-2 text-sm text-red-600"
            >
              {{ formErrors.name }}
            </p>
          </label>

          <label class="block">
            <span class="mb-2 block text-sm font-medium text-stone-700">Color</span>
            <input
              id="category-color"
              v-model="form.color"
              type="color"
              :aria-describedby="formErrors.color ? 'category-color-error' : undefined"
              :aria-invalid="Boolean(formErrors.color)"
              class="h-12.5 w-20 rounded-2xl border border-stone-300 bg-white p-2"
            />
            <p
              v-if="formErrors.color"
              id="category-color-error"
              class="ml-3 mt-2 text-sm text-red-600"
            >
              {{ formErrors.color }}
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
            {{ submitting ? 'Saving...' : 'Save category' }}
          </button>
        </div>
      </form>
    </section>

    <section class="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
      <div v-if="loading" class="space-y-3" role="status" aria-label="Loading categories">
        <div class="h-5 w-40 animate-pulse rounded bg-stone-200"></div>
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
        <p class="font-medium">Could not load categories</p>
        <p class="mt-1">{{ error }}</p>
      </div>

      <div
        v-else-if="categories.length === 0"
        class="rounded-2xl border border-dashed border-stone-200 bg-stone-50 px-5 py-12 text-center"
      >
        <p class="text-base font-medium text-stone-700">No categories yet</p>
      </div>

      <div v-else class="space-y-3">
        <article
          v-for="category in categories"
          :key="category.id"
          class="rounded-2xl border border-stone-200 bg-stone-50 px-5 py-4 transition hover:border-stone-300 hover:bg-stone-100"
        >
          <div class="flex items-center justify-between gap-3">
            <div class="flex min-w-0 items-center gap-3">
              <span
                class="h-4 w-4 shrink-0 rounded-full ring-1 ring-black/5"
                :style="{ backgroundColor: category.color ?? '#94a3b8' }"
              />
              <div class="min-w-0">
                <h3 class="text-base font-semibold tracking-tight text-stone-900">
                  {{ category.name }}
                </h3>
              </div>
            </div>

            <div class="flex shrink-0 items-center gap-3">
              <button
                type="button"
                class="inline-flex items-center rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-600 transition hover:border-stone-300 hover:text-stone-900"
                @click="openEditForm(category)"
              >
                Edit
              </button>

              <button
                type="button"
                class="inline-flex items-center rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-700 transition hover:border-red-300 hover:text-red-800"
                @click="archive(category)"
              >
                Archive
              </button>
            </div>
          </div>
        </article>
      </div>

      <nav
        v-if="!loading && !error && pagination.totalPages > 1"
        aria-label="Expense category pagination"
        class="mt-6 flex flex-col gap-3 border-t border-stone-200 pt-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <p class="text-sm text-stone-500">
          Page {{ pagination.page }} of {{ pagination.totalPages }} ·
          {{ pagination.totalItems }} categories
        </p>

        <div class="flex items-center gap-2">
          <button
            type="button"
            :disabled="pagination.page === 1"
            class="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-600 transition hover:border-stone-300 hover:text-stone-900 disabled:cursor-not-allowed disabled:text-stone-300"
            @click="changePage(pagination.page - 1)"
          >
            Previous
          </button>
          <button
            type="button"
            :disabled="pagination.page === pagination.totalPages"
            class="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-600 transition hover:border-stone-300 hover:text-stone-900 disabled:cursor-not-allowed disabled:text-stone-300"
            @click="changePage(pagination.page + 1)"
          >
            Next
          </button>
        </div>
      </nav>
    </section>
  </section>
</template>
