<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ApiError } from '@/lib/api'
import { formatDateTime } from '@/lib/helpers'
import {
  fetchArchivedExpenseCategories,
  restoreExpenseCategory,
  removeExpenseCategory,
} from '@/lib/expense-categories/api'
import { expenseCategorySchema, type ExpenseCategory } from '@/lib/expense-categories/schema'

const categories = ref<ExpenseCategory[]>([])
const loading = ref(true)
const error = ref('')
const actionError = ref('')
const restoringId = ref<string | null>(null)
const removingId = ref<string | null>(null)

async function loadArchivedCategories() {
  try {
    error.value = ''
    const validated: ExpenseCategory[] = []

    for (const category of await fetchArchivedExpenseCategories()) {
      const result = expenseCategorySchema.safeParse(category)
      if (result.success) {
        validated.push(result.data)
      }
    }

    categories.value = validated
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Something went wrong'
  } finally {
    loading.value = false
  }
}

async function restore(category: ExpenseCategory) {
  actionError.value = ''
  restoringId.value = category.id

  try {
    if (!confirm('Are you sure you want to restore this category?')) {
      return
    }

    const result = expenseCategorySchema.safeParse(await restoreExpenseCategory(category.id))

    if (!result.success) {
      actionError.value = 'Failed to fetch restored category'
      return
    }

    categories.value = categories.value.filter((item) => item.id !== result.data.id)
  } catch (err) {
    actionError.value = err instanceof ApiError ? err.message : 'Restoring category failed'
  } finally {
    restoringId.value = null
  }
}
async function remove(category: ExpenseCategory) {
  actionError.value = ''
  removingId.value = category.id

  try {
    if (!confirm('Are you sure you want to remove this category?')) {
      return
    }

    await removeExpenseCategory(category.id)
    categories.value = categories.value.filter((item) => item.id !== category.id)
  } catch (err) {
    actionError.value = err instanceof ApiError ? err.message : 'Removing category failed'
  } finally {
    removingId.value = null
  }
}

onMounted(loadArchivedCategories)
</script>

<template>
  <section class="space-y-8">
    <header class="space-y-3">
      <p class="text-xs font-semibold uppercase tracking-[0.24em] text-stone-400">Categories</p>

      <div>
        <h2 class="text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">
          Archived categories
        </h2>
        <p class="mt-2 max-w-2xl text-sm leading-6 text-stone-500 sm:text-base">
          Restore categories when they should become available for future expenses again.
        </p>
      </div>

      <div
        v-if="actionError"
        class="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
      >
        {{ actionError }}
      </div>
    </header>

    <section class="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
      <div v-if="loading" class="space-y-3" role="status" aria-label="Loading archived categories">
        <div class="h-5 w-48 animate-pulse rounded bg-stone-200"></div>
        <div class="space-y-2">
          <div class="h-16 animate-pulse rounded-2xl bg-stone-100"></div>
          <div class="h-16 animate-pulse rounded-2xl bg-stone-100"></div>
        </div>
      </div>

      <div
        v-else-if="error"
        class="rounded-2xl border border-red-200 bg-red-50 px-4 py-5 text-sm text-red-700"
      >
        <p class="font-medium">Could not load archived categories</p>
        <p class="mt-1">{{ error }}</p>
      </div>

      <div
        v-else-if="categories.length === 0"
        class="rounded-2xl border border-dashed border-stone-200 bg-stone-50 px-5 py-12 text-center"
      >
        <p class="text-base font-medium text-stone-700">No archived categories</p>
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
                <p v-if="category.archivedAt" class="mt-1 text-xs text-stone-500">
                  Archived
                  <time :datetime="category.archivedAt">
                    {{ formatDateTime(category.archivedAt) }}
                  </time>
                </p>
              </div>
            </div>

            <div class="flex shrink-0 items-center gap-3">
              <button
                type="button"
                :disabled="restoringId === category.id"
                class="inline-flex items-center rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-600 transition hover:border-stone-300 hover:text-stone-900 disabled:cursor-not-allowed disabled:opacity-60"
                @click="restore(category)"
              >
                {{ restoringId === category.id ? 'Restoring...' : 'Restore' }}
              </button>

              <button
                type="button"
                :disabled="removingId === category.id"
                class="inline-flex items-center rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-600 transition hover:border-stone-300 hover:text-stone-900 disabled:cursor-not-allowed disabled:opacity-60"
                @click="remove(category)"
              >
                {{ removingId === category.id ? 'Removing...' : 'Remove' }}
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
