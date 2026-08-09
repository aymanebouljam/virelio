<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ApiError } from '@/lib/api'
import { formatAmount, formatDate, formatDateTime } from '@/lib/helpers'
import {
  fetchArchivedRecurringExpenses,
  removeRecurringExpense,
  restoreRecurringExpense,
} from '@/lib/recurring-expenses/api'
import {
  recurringExpenseRecordSchema,
  recurringExpenseTemplateSchema,
  type RecurringExpenseTemplate,
} from '@/lib/recurring-expenses/schema'

const templates = ref<RecurringExpenseTemplate[]>([])
const loading = ref(true)
const error = ref('')
const actionError = ref('')
const restoringId = ref<string | null>(null)
const removingId = ref<string | null>(null)

async function loadArchivedTemplates() {
  try {
    error.value = ''
    templates.value = (await fetchArchivedRecurringExpenses())
      .map((template) => recurringExpenseTemplateSchema.safeParse(template))
      .filter((result) => result.success)
      .map((result) => result.data)
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Something went wrong'
  } finally {
    loading.value = false
  }
}

async function restore(template: RecurringExpenseTemplate) {
  actionError.value = ''
  if (!confirm('Are you sure you want to restore this recurring expense?')) return

  restoringId.value = template.id
  try {
    const restored = recurringExpenseRecordSchema.parse(await restoreRecurringExpense(template.id))
    templates.value = templates.value.filter((item) => item.id !== restored.id)
  } catch (err) {
    actionError.value = err instanceof ApiError ? err.message : 'Restoring recurring expense failed'
  } finally {
    restoringId.value = null
  }
}

async function remove(template: RecurringExpenseTemplate) {
  actionError.value = ''
  if (!confirm('Are you sure you want to permanently remove this recurring expense?')) return

  removingId.value = template.id
  try {
    await removeRecurringExpense(template.id)
    templates.value = templates.value.filter((item) => item.id !== template.id)
  } catch (err) {
    actionError.value = err instanceof ApiError ? err.message : 'Removing recurring expense failed'
  } finally {
    removingId.value = null
  }
}

onMounted(loadArchivedTemplates)
</script>

<template>
  <section class="space-y-8">
    <header class="space-y-3">
      <p class="text-xs font-semibold uppercase tracking-[0.24em] text-stone-400">
        Recurring expenses
      </p>
      <div>
        <h2 class="text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">
          Archived recurring expenses
        </h2>
        <p class="mt-2 max-w-2xl text-sm leading-6 text-stone-500 sm:text-base">
          Restore schedules for future use or permanently remove templates you no longer need.
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
      <div
        v-if="loading"
        role="status"
        aria-label="Loading archived recurring expenses"
        class="space-y-3"
      >
        <div class="h-16 animate-pulse rounded-2xl bg-stone-100"></div>
        <div class="h-16 animate-pulse rounded-2xl bg-stone-100"></div>
      </div>

      <div
        v-else-if="error"
        role="alert"
        class="rounded-2xl border border-red-200 bg-red-50 px-4 py-5 text-sm text-red-700"
      >
        <p class="font-medium">Could not load archived recurring expenses</p>
        <p class="mt-1">{{ error }}</p>
      </div>

      <div
        v-else-if="templates.length === 0"
        class="rounded-2xl border border-dashed border-stone-200 bg-stone-50 px-5 py-12 text-center"
      >
        <p class="text-base font-medium text-stone-700">No archived recurring expenses</p>
      </div>

      <div v-else class="space-y-3">
        <article
          v-for="template in templates"
          :key="template.id"
          class="rounded-2xl border border-stone-200 bg-stone-50 px-5 py-4"
        >
          <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div class="min-w-0">
              <h3 class="text-base font-semibold tracking-tight text-stone-900">
                {{ template.description }}
              </h3>
              <div class="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-stone-500">
                <span>{{ template.vendor.name }}</span>
                <span>{{ template.category?.name ?? 'No category' }}</span>
                <span>{{ template.frequency.toLowerCase() }}</span>
                <span>Next {{ formatDate(template.nextDueDate) }}</span>
              </div>
              <p v-if="template.archivedAt" class="mt-2 text-xs text-stone-500">
                Archived
                <time :datetime="template.archivedAt">
                  {{ formatDateTime(template.archivedAt) }}
                </time>
              </p>
            </div>

            <div class="flex flex-wrap items-center gap-2">
              <span class="mr-1 text-sm font-semibold text-stone-900">
                {{ formatAmount(template.amount) }} {{ template.currency }}
              </span>
              <button
                type="button"
                :aria-label="`Restore ${template.description}`"
                :disabled="restoringId === template.id"
                class="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-600 hover:border-stone-300 disabled:cursor-not-allowed disabled:opacity-60"
                @click="restore(template)"
              >
                {{ restoringId === template.id ? 'Restoring...' : 'Restore' }}
              </button>
              <button
                type="button"
                :aria-label="`Remove ${template.description}`"
                :disabled="removingId === template.id"
                class="rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:border-red-300 disabled:cursor-not-allowed disabled:opacity-60"
                @click="remove(template)"
              >
                {{ removingId === template.id ? 'Removing...' : 'Remove' }}
              </button>
            </div>
          </div>
        </article>
      </div>
    </section>
  </section>
</template>
