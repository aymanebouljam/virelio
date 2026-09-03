<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ArchiveRestore, ArrowLeft, CalendarClock, EllipsisVertical, Trash2 } from '@lucide/vue'
import LedgerSurface from '@/components/ui/LedgerSurface.vue'
import RecordActionSheet, { type RecordActionItem } from '@/components/ui/RecordActionSheet.vue'
import WorkspaceHeader from '@/components/ui/WorkspaceHeader.vue'
import { ApiError } from '@/lib/api'
import { requestConfirmation } from '@/lib/confirmation'
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
const mobileActionsOpen = ref(false)
const activeActionTemplate = ref<RecurringExpenseTemplate | null>(null)

const mobileTemplateActions = [
  { id: 'restore', label: 'Restore schedule', icon: ArchiveRestore },
  { id: 'remove', label: 'Remove schedule', icon: Trash2, tone: 'danger' },
] as const satisfies readonly RecordActionItem[]

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
  if (!(await requestConfirmation('Are you sure you want to restore this recurring expense?')))
    return

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
  if (
    !(await requestConfirmation(
      'Are you sure you want to permanently remove this recurring expense?',
    ))
  )
    return

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

function openMobileActions(template: RecurringExpenseTemplate) {
  activeActionTemplate.value = template
  mobileActionsOpen.value = true
}

function handleMobileAction(actionId: string) {
  const template = activeActionTemplate.value
  if (!template) return

  mobileActionsOpen.value = false
  activeActionTemplate.value = null

  if (actionId === 'restore') {
    void restore(template)
  } else if (actionId === 'remove') {
    void remove(template)
  }
}

onMounted(loadArchivedTemplates)
</script>

<template>
  <section class="min-w-0 space-y-6">
    <WorkspaceHeader
      context="Archive"
      title="Archived schedules"
      description="Restore a repeat cost to active planning, or permanently remove a schedule you no longer need."
    >
      <template #actions>
        <RouterLink
          to="/recurring-expenses"
          class="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-line bg-surface px-3 text-sm font-semibold text-ink-muted transition hover:border-line-strong hover:bg-surface-muted hover:text-ink"
        >
          <ArrowLeft :size="16" aria-hidden="true" />
          Active schedules
        </RouterLink>
      </template>
    </WorkspaceHeader>

    <div
      v-if="actionError"
      role="alert"
      class="rounded-xl border border-danger/25 bg-danger-soft px-4 py-3 text-sm text-danger"
    >
      {{ actionError }}
    </div>

    <LedgerSurface class="overflow-hidden">
      <header class="border-b border-line px-5 py-4 sm:px-6">
        <p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
          Inactive schedules
        </p>
        <h2 class="font-display mt-1 text-lg font-semibold tracking-[-0.02em] text-ink">
          Archived recurring ledger
        </h2>
        <p class="mt-1 text-xs text-ink-muted">
          {{ templates.length }} archived schedule{{ templates.length === 1 ? '' : 's' }}
        </p>
      </header>

      <div
        v-if="loading"
        role="status"
        aria-label="Loading archived recurring expenses"
        class="space-y-3 p-5 sm:p-6"
      >
        <div class="h-20 animate-pulse rounded-lg bg-surface-muted/70"></div>
        <div class="h-20 animate-pulse rounded-lg bg-surface-muted/70"></div>
      </div>

      <div
        v-else-if="error"
        role="alert"
        class="m-5 rounded-lg border border-danger/25 bg-danger-soft px-4 py-5 text-sm text-danger sm:m-6"
      >
        <p class="font-medium">Could not load archived recurring expenses</p>
        <p class="mt-1">{{ error }}</p>
      </div>

      <div v-else-if="templates.length === 0" class="px-5 py-14 text-center sm:px-6">
        <span
          class="mx-auto flex size-11 items-center justify-center rounded-lg bg-surface-muted text-ink-muted"
        >
          <ArchiveRestore :size="20" aria-hidden="true" />
        </span>
        <p class="mt-3 text-sm font-semibold text-ink">No archived recurring expenses</p>
        <p class="mt-1 text-sm text-ink-muted">Archived schedules will appear here for review.</p>
      </div>

      <div v-else class="divide-y divide-line">
        <article
          v-for="template in templates"
          :key="template.id"
          data-archived-recurring-record
          class="relative min-w-0 px-4 py-5 transition hover:bg-surface-muted/45 sm:px-6"
        >
          <span class="absolute inset-y-0 left-0 w-0.5 bg-line-strong" aria-hidden="true" />
          <div
            class="relative flex min-w-0 flex-col gap-2 md:static md:gap-4 lg:flex-row lg:items-center lg:justify-between"
          >
            <div class="flex min-w-0 items-start gap-3.5">
              <span
                class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-ink-muted"
              >
                <CalendarClock :size="17" aria-hidden="true" />
              </span>
              <div class="min-w-0">
                <h3 class="truncate text-base font-semibold tracking-[-0.015em] text-ink">
                  {{ template.description }}
                </h3>
                <div
                  class="mt-2.5 grid min-w-0 grid-cols-1 gap-y-1.5 text-xs text-ink-muted sm:flex sm:flex-wrap sm:gap-x-3"
                >
                  <span class="truncate">{{ template.vendor.name }}</span>
                  <span class="truncate">{{ template.category?.name ?? 'No category' }}</span>
                  <span class="capitalize">{{ template.frequency.toLowerCase() }}</span>
                  <span>Next {{ formatDate(template.nextDueDate) }}</span>
                </div>
                <p v-if="template.archivedAt" class="mt-2 text-xs text-ink-muted">
                  Archived
                  <time :datetime="template.archivedAt" class="font-figure">
                    {{ formatDateTime(template.archivedAt) }}
                  </time>
                </p>
              </div>
            </div>

            <div class="flex min-w-0 flex-wrap items-center justify-end gap-2 lg:justify-end">
              <span class="font-figure mr-auto text-base font-semibold text-ink sm:mr-2">
                {{ formatAmount(template.amount) }} {{ template.currency }}
              </span>
              <button
                type="button"
                :aria-label="`Restore ${template.description}`"
                title="Restore schedule"
                :disabled="restoringId === template.id"
                class="hidden min-h-11 min-w-11 items-center justify-center rounded-xl bg-brand-soft px-2.5 text-brand transition hover:bg-brand hover:text-white disabled:cursor-not-allowed disabled:opacity-60 sm:inline-flex"
                @click="restore(template)"
              >
                <ArchiveRestore :size="17" :stroke-width="1.8" aria-hidden="true" />
              </button>
              <button
                type="button"
                :aria-label="`Remove ${template.description}`"
                title="Remove schedule"
                :disabled="removingId === template.id"
                class="hidden min-h-11 min-w-11 items-center justify-center rounded-xl bg-danger-soft px-2.5 text-danger transition hover:bg-danger hover:text-white disabled:cursor-not-allowed disabled:opacity-60 sm:inline-flex"
                @click="remove(template)"
              >
                <Trash2 :size="17" :stroke-width="1.8" aria-hidden="true" />
              </button>
              <button
                type="button"
                data-mobile-archived-recurring-actions
                class="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-line bg-surface px-2.5 text-ink-muted transition hover:border-line-strong hover:bg-surface-muted hover:text-ink sm:hidden"
                :aria-label="`Actions for ${template.description}`"
                title="More actions"
                @click="openMobileActions(template)"
              >
                <EllipsisVertical :size="18" aria-hidden="true" />
              </button>
            </div>
          </div>
        </article>
      </div>
    </LedgerSurface>

    <RecordActionSheet
      :open="mobileActionsOpen"
      :record-label="activeActionTemplate?.description ?? 'schedule'"
      :actions="mobileTemplateActions"
      @update:open="mobileActionsOpen = $event"
      @select="handleMobileAction"
    />
  </section>
</template>
