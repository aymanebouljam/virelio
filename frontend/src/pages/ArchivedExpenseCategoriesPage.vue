<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ArchiveRestore, EllipsisVertical, Tags, Trash2 } from '@lucide/vue'
import { ApiError } from '@/lib/api'
import { formatDateTime } from '@/lib/helpers'
import {
  fetchArchivedExpenseCategories,
  restoreExpenseCategory,
  removeExpenseCategory,
} from '@/lib/expense-categories/api'
import { expenseCategorySchema, type ExpenseCategory } from '@/lib/expense-categories/schema'
import RecordActionSheet, { type RecordActionItem } from '@/components/ui/RecordActionSheet.vue'

const categories = ref<ExpenseCategory[]>([])
const loading = ref(true)
const error = ref('')
const actionError = ref('')
const restoringId = ref<string | null>(null)
const removingId = ref<string | null>(null)
const mobileActionsOpen = ref(false)
const activeActionCategory = ref<ExpenseCategory | null>(null)

const mobileCategoryActions = [
  { id: 'restore', label: 'Restore category', icon: ArchiveRestore },
  { id: 'remove', label: 'Remove category', icon: Trash2, tone: 'danger' },
] as const satisfies readonly RecordActionItem[]

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

function openMobileActions(category: ExpenseCategory) {
  activeActionCategory.value = category
  mobileActionsOpen.value = true
}

function handleMobileAction(actionId: string) {
  const category = activeActionCategory.value
  if (!category) return

  mobileActionsOpen.value = false
  activeActionCategory.value = null

  if (actionId === 'restore') {
    void restore(category)
  } else if (actionId === 'remove') {
    void remove(category)
  }
}

onMounted(loadArchivedCategories)
</script>

<template>
  <section class="min-w-0 space-y-6">
    <header class="space-y-4 border-b border-line pb-6">
      <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
        Category archive
      </p>

      <div>
        <h1
          class="font-display text-[2rem] font-semibold leading-tight tracking-[-0.035em] text-ink sm:text-[2.5rem]"
        >
          Categories held outside active records.
        </h1>
        <p class="mt-2 max-w-2xl text-sm leading-6 text-ink-muted sm:text-[15px]">
          Restore a category for future expenses, or permanently remove one that is no longer
          needed.
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
          Inactive categories
        </p>
        <h2 class="font-display mt-1 text-lg font-semibold tracking-[-0.02em] text-ink">
          Archived category ledger
        </h2>
        <p class="mt-1 text-xs text-ink-muted">
          {{ categories.length }} archived categor{{ categories.length === 1 ? 'y' : 'ies' }}
        </p>
      </header>

      <div
        v-if="loading"
        class="space-y-3 p-5 sm:p-6"
        role="status"
        aria-label="Loading archived categories"
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
        <p class="font-medium">Could not load archived categories</p>
        <p class="mt-1">{{ error }}</p>
      </div>

      <div v-else-if="categories.length === 0" class="px-5 py-14 text-center sm:px-6">
        <span
          class="mx-auto flex size-11 items-center justify-center rounded-lg bg-surface-muted text-ink-muted"
        >
          <ArchiveRestore :size="20" aria-hidden="true" />
        </span>
        <p class="mt-3 text-sm font-semibold text-ink">No archived categories</p>
        <p class="mt-1 text-sm text-ink-muted">
          Archived categories will appear here when removed from the active list.
        </p>
      </div>

      <div v-else class="divide-y divide-line">
        <article
          v-for="category in categories"
          :key="category.id"
          data-archived-category-record
          class="relative min-w-0 px-4 py-5 transition hover:bg-surface-muted/45 sm:px-6"
        >
          <span class="absolute inset-y-0 left-0 w-0.5 bg-line-strong" aria-hidden="true" />
          <div
            class="relative flex min-w-0 flex-col gap-2 md:static md:gap-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div class="flex min-w-0 items-center gap-3.5">
              <span
                class="relative flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-ink-muted"
              >
                <Tags :size="17" aria-hidden="true" />
                <span
                  class="absolute -bottom-1 -right-1 size-3 rounded-full border-2 border-surface"
                  :style="{ backgroundColor: category.color ?? '#94a3b8' }"
                  aria-hidden="true"
                />
              </span>
              <div class="min-w-0">
                <h3 class="truncate text-base font-semibold tracking-[-0.015em] text-ink">
                  {{ category.name }}
                </h3>
                <p v-if="category.archivedAt" class="mt-2 text-xs text-ink-muted">
                  Archived
                  <time :datetime="category.archivedAt" class="font-figure">
                    {{ formatDateTime(category.archivedAt) }}
                  </time>
                </p>
              </div>
            </div>

            <div class="flex min-w-0 flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                :aria-label="`Restore ${category.name}`"
                title="Restore category"
                :disabled="restoringId === category.id"
                class="hidden min-h-11 min-w-11 items-center justify-center rounded-xl bg-brand-soft px-2.5 text-brand transition hover:bg-brand hover:text-white disabled:cursor-not-allowed disabled:opacity-60 sm:inline-flex"
                @click="restore(category)"
              >
                <ArchiveRestore :size="17" :stroke-width="1.8" aria-hidden="true" />
              </button>

              <button
                type="button"
                :aria-label="`Remove ${category.name}`"
                title="Remove category"
                :disabled="removingId === category.id"
                class="hidden min-h-11 min-w-11 items-center justify-center rounded-xl bg-danger-soft px-2.5 text-danger transition hover:bg-danger hover:text-white disabled:cursor-not-allowed disabled:opacity-60 sm:inline-flex"
                @click="remove(category)"
              >
                <Trash2 :size="17" :stroke-width="1.8" aria-hidden="true" />
              </button>

              <span class="border-l-2 border-line-strong pl-2 text-xs font-semibold text-ink-muted">
                Archived
              </span>
              <button
                type="button"
                data-mobile-archived-category-actions
                class="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-line bg-surface px-2.5 text-ink-muted transition hover:border-line-strong hover:bg-surface-muted hover:text-ink sm:hidden"
                :aria-label="`Actions for ${category.name}`"
                @click="openMobileActions(category)"
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
      :record-label="activeActionCategory?.name ?? 'category'"
      :actions="mobileCategoryActions"
      @update:open="mobileActionsOpen = $event"
      @select="handleMobileAction"
    />
  </section>
</template>
