<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import {
  ArrowRight,
  CalendarClock,
  CalendarDays,
  FileText,
  FileWarning,
  Plus,
  ReceiptText,
  Tags,
} from '@lucide/vue'
import { ApiError } from '@/lib/api'
import { fetchDashboardSummary } from '@/lib/dashboard/api'
import { formatDate } from '@/lib/helpers'
import { dashboardSummarySchema, type DashboardSummary } from '@/lib/dashboard/schema'
import LedgerSurface from '@/components/ui/LedgerSurface.vue'
import WorkspaceHeader from '@/components/ui/WorkspaceHeader.vue'

const route = useRoute()
const router = useRouter()
const summary = ref<DashboardSummary | null>(null)
const loading = ref(true)
const error = ref('')
const dateRangeError = ref('')

const dateFrom = computed(() => {
  const value = route.query.dateFrom
  return typeof value === 'string' ? value : undefined
})

const dateTo = computed(() => {
  const value = route.query.dateTo
  return typeof value === 'string' ? value : undefined
})

const hasDateRange = computed(() => Boolean(dateFrom.value || dateTo.value))
const hasRecentActivity = computed(() => (summary.value?.recentActivity.length ?? 0) > 0)
const hasAttentionItems = computed(
  () =>
    Boolean(summary.value?.dueRecurringExpenses) ||
    Boolean(summary.value?.missingProofExpenses) ||
    Boolean(summary.value?.uncategorizedExpenses),
)
const attentionItemCount = computed(
  () =>
    Number(Boolean(summary.value?.dueRecurringExpenses)) +
    Number(Boolean(summary.value?.missingProofExpenses)) +
    Number(Boolean(summary.value?.uncategorizedExpenses)),
)

async function loadSummary() {
  try {
    error.value = ''
    dateRangeError.value = ''
    const result = dashboardSummarySchema.safeParse(
      await fetchDashboardSummary({
        dateFrom: dateFrom.value,
        dateTo: dateTo.value,
      }),
    )

    if (!result.success) {
      error.value = 'Failed to validate dashboard summary'
      return
    }

    summary.value = result.data
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.content && typeof err.content.dateRange === 'string') {
        dateRangeError.value = err.content.dateRange
        error.value = dateRangeError.value
      } else {
        error.value = err.message
      }
    } else {
      error.value = 'Something went wrong'
    }
  } finally {
    loading.value = false
  }
}

async function updateDateRange(next: { dateFrom?: string; dateTo?: string }) {
  const query = { ...route.query }

  if (next.dateFrom) {
    query.dateFrom = next.dateFrom
  } else {
    delete query.dateFrom
  }

  if (next.dateTo) {
    query.dateTo = next.dateTo
  } else {
    delete query.dateTo
  }

  await router.replace({ query })
}

watch(
  () => [dateFrom.value, dateTo.value],
  () => {
    loading.value = true
    void loadSummary()
  },
)

onMounted(loadSummary)
</script>

<template>
  <section class="min-w-0 space-y-6">
    <WorkspaceHeader
      context="Expense pulse"
      title="See what your money is doing."
      description="A live view of recorded spend, proof, and the work that still needs attention."
    >
      <template #actions>
        <RouterLink
          to="/expenses"
          class="inline-flex min-h-11 w-fit items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-white transition hover:bg-brand-strong"
        >
          Manage expenses
          <ArrowRight :size="17" aria-hidden="true" />
        </RouterLink>
      </template>
    </WorkspaceHeader>

    <fieldset
      class="grid gap-4 rounded-xl border border-line bg-surface-raised px-4 py-4 lg:grid-cols-[1fr_auto] lg:items-end"
    >
      <legend class="sr-only">Dashboard date range</legend>

      <div class="flex items-center gap-3 lg:self-center">
        <span class="flex size-9 items-center justify-center rounded-lg bg-brand-soft text-brand">
          <CalendarDays :size="17" aria-hidden="true" />
        </span>
        <div>
          <p class="text-sm font-semibold text-ink">Reporting period</p>
          <p class="text-xs text-ink-muted">
            {{ hasDateRange ? 'Custom date range' : 'All recorded expenses' }}
          </p>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-3 max-[375px]:grid-cols-1 sm:flex sm:items-end">
        <div class="flex min-w-0 flex-col gap-1.5">
          <label for="dashboard-date-from" class="text-xs font-medium text-ink-muted">From</label>
          <input
            id="dashboard-date-from"
            :value="dateFrom"
            type="date"
            :aria-describedby="dateRangeError ? 'dashboard-date-range-error' : undefined"
            :aria-invalid="Boolean(dateRangeError)"
            class="min-h-10 w-full min-w-0 rounded-lg border border-line bg-surface-raised px-3 py-2 text-sm text-ink outline-none transition hover:border-line-strong focus:border-brand focus:bg-surface sm:w-auto"
            @change="
              updateDateRange({
                dateFrom: ($event.target as HTMLInputElement).value,
                dateTo: dateTo,
              })
            "
          />
        </div>

        <div class="flex min-w-0 flex-col gap-1.5">
          <label for="dashboard-date-to" class="text-xs font-medium text-ink-muted">To</label>
          <input
            id="dashboard-date-to"
            :value="dateTo"
            type="date"
            :aria-describedby="dateRangeError ? 'dashboard-date-range-error' : undefined"
            :aria-invalid="Boolean(dateRangeError)"
            class="min-h-10 w-full min-w-0 rounded-lg border border-line bg-surface-raised px-3 py-2 text-sm text-ink outline-none transition hover:border-line-strong focus:border-brand focus:bg-surface sm:w-auto"
            @change="
              updateDateRange({
                dateFrom: dateFrom,
                dateTo: ($event.target as HTMLInputElement).value,
              })
            "
          />
        </div>

        <button
          v-if="hasDateRange"
          type="button"
          class="col-span-2 min-h-10 rounded-lg px-3 text-sm font-medium text-ink-muted transition hover:bg-surface-muted hover:text-ink max-[375px]:col-span-1 sm:col-span-1"
          @click="updateDateRange({ dateFrom: undefined, dateTo: undefined })"
        >
          Clear
        </button>
      </div>
    </fieldset>

    <div
      v-if="loading && !summary"
      class="grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2 xl:grid-cols-4"
      role="status"
      aria-label="Loading dashboard"
    >
      <div v-for="index in 4" :key="index" class="h-36 animate-pulse bg-surface-muted/70" />
    </div>

    <section
      v-else-if="error && !summary"
      role="alert"
      class="rounded-xl border border-danger/25 bg-danger-soft px-5 py-4 text-sm text-danger"
    >
      <p class="font-medium">Could not load dashboard</p>
      <p :id="dateRangeError ? 'dashboard-date-range-error' : undefined" class="mt-1">
        {{ error }}
      </p>
    </section>

    <template v-else-if="summary">
      <p v-if="loading" role="status" aria-live="polite" class="text-sm text-ink-muted">
        Updating dashboard…
      </p>

      <section
        v-if="error"
        role="alert"
        class="rounded-xl border border-danger/25 bg-danger-soft px-5 py-4 text-sm text-danger"
      >
        <p class="font-medium">Could not update dashboard</p>
        <p :id="dateRangeError ? 'dashboard-date-range-error' : undefined" class="mt-1">
          {{ error }}
        </p>
      </section>

      <section
        v-if="hasAttentionItems"
        data-dashboard-attention
        class="grid overflow-hidden rounded-xl border border-line bg-surface shadow-card"
        :class="
          attentionItemCount === 1
            ? 'sm:grid-cols-1'
            : attentionItemCount === 2
              ? 'sm:grid-cols-2'
              : 'sm:grid-cols-3'
        "
        aria-label="Needs attention"
      >
        <RouterLink
          v-if="summary.dueRecurringExpenses"
          :to="{ path: '/recurring-expenses', query: { due: 'next-7-days' } }"
          class="group flex min-h-28 items-center gap-4 px-5 py-5 transition hover:bg-surface-muted"
          :class="attentionItemCount > 1 ? 'border-b border-line sm:border-b-0 sm:border-r' : ''"
        >
          <span
            class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-evidence-soft text-evidence"
          >
            <CalendarClock :size="19" :stroke-width="1.8" aria-hidden="true" />
          </span>
          <span class="min-w-0">
            <span class="font-figure block text-2xl font-semibold tracking-[-0.04em] text-ink">
              {{ summary.dueRecurringExpenses }}
            </span>
            <span class="mt-0.5 block text-sm font-semibold text-ink">Due this week</span>
          </span>
          <ArrowRight
            :size="16"
            aria-hidden="true"
            class="ml-auto shrink-0 text-line-strong transition group-hover:translate-x-0.5 group-hover:text-brand"
          />
        </RouterLink>

        <RouterLink
          v-if="summary.missingProofExpenses"
          :to="{ path: '/expenses', query: { proofStatus: 'missing' } }"
          class="group flex min-h-28 items-center gap-4 px-5 py-5 transition hover:bg-surface-muted"
          :class="
            summary.uncategorizedExpenses ? 'border-b border-line sm:border-b-0 sm:border-r' : ''
          "
        >
          <span
            class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-warning-soft text-warning"
          >
            <FileWarning :size="19" :stroke-width="1.8" aria-hidden="true" />
          </span>
          <span class="min-w-0">
            <span class="font-figure block text-2xl font-semibold tracking-[-0.04em] text-ink">
              {{ summary.missingProofExpenses }}
            </span>
            <span class="mt-0.5 block text-sm font-semibold text-ink">Missing receipts</span>
          </span>
          <ArrowRight
            :size="16"
            aria-hidden="true"
            class="ml-auto shrink-0 text-line-strong transition group-hover:translate-x-0.5 group-hover:text-brand"
          />
        </RouterLink>

        <RouterLink
          v-if="summary.uncategorizedExpenses"
          :to="{ path: '/expenses', query: { categoryStatus: 'missing' } }"
          class="group flex min-h-28 items-center gap-4 px-5 py-5 transition hover:bg-surface-muted"
        >
          <span
            class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand"
          >
            <Tags :size="19" :stroke-width="1.8" aria-hidden="true" />
          </span>
          <span class="min-w-0">
            <span class="font-figure block text-2xl font-semibold tracking-[-0.04em] text-ink">
              {{ summary.uncategorizedExpenses }}
            </span>
            <span class="mt-0.5 block text-sm font-semibold text-ink">Need a category</span>
          </span>
          <ArrowRight
            :size="16"
            aria-hidden="true"
            class="ml-auto shrink-0 text-line-strong transition group-hover:translate-x-0.5 group-hover:text-brand"
          />
        </RouterLink>
      </section>

      <LedgerSurface data-dashboard-recent-activity class="overflow-hidden">
        <header
          class="flex flex-col items-start gap-3 border-b border-line px-4 py-4 sm:flex-row sm:justify-between sm:px-6"
        >
          <div>
            <p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
              Evidence trail
            </p>
            <h2 class="font-display mt-1 text-lg font-semibold tracking-[-0.02em] text-ink">
              Latest entries
            </h2>
            <p class="mt-1 text-sm text-ink-muted">The newest expense and proof records.</p>
          </div>
          <RouterLink
            to="/expenses"
            class="inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:text-brand-strong"
          >
            View all
            <ArrowRight :size="15" aria-hidden="true" />
          </RouterLink>
        </header>

        <div v-if="!hasRecentActivity" class="px-5 py-12 text-center sm:px-6">
          <span
            class="mx-auto flex size-11 items-center justify-center rounded-lg bg-brand-soft text-brand"
          >
            <ReceiptText :size="22" :stroke-width="1.7" aria-hidden="true" />
          </span>
          <p class="mt-4 text-sm font-semibold text-ink">No activity yet</p>
          <p class="mx-auto mt-1 max-w-sm text-sm leading-6 text-ink-muted">
            Record your first expense to start building a useful spending overview.
          </p>
          <RouterLink
            to="/expenses"
            class="mt-5 inline-flex min-h-10 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-strong"
          >
            <Plus :size="16" aria-hidden="true" />
            Add an expense
          </RouterLink>
        </div>

        <div v-else class="relative min-w-0 divide-y divide-line border-l-2 border-l-accent/70">
          <RouterLink
            v-for="item in summary.recentActivity"
            :key="`${item.type}-${item.id}`"
            :to="`/expenses/${item.expenseId}`"
            class="group grid min-w-0 grid-cols-[2.25rem_minmax(0,1fr)_1.25rem] items-center gap-3 px-4 py-4 transition hover:bg-surface-muted/55 sm:grid-cols-[2.25rem_minmax(0,1fr)_1.25rem] sm:px-6"
          >
            <span
              class="flex size-9 shrink-0 items-center justify-center rounded-lg"
              :class="
                item.type === 'proof' ? 'bg-accent-soft text-accent' : 'bg-brand-soft text-brand'
              "
            >
              <FileText v-if="item.type === 'proof'" :size="18" aria-hidden="true" />
              <ReceiptText v-else :size="18" aria-hidden="true" />
            </span>

            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <p class="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
                  {{ item.title }}
                </p>
                <span
                  class="shrink-0 border-l border-line-strong pl-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted"
                >
                  {{ item.type === 'proof' ? 'Proof' : 'Expense' }}
                </span>
              </div>
              <p class="mt-1 truncate text-xs text-ink-muted">
                {{ item.subtitle }} · {{ formatDate(item.occurredAt) }}
              </p>
            </div>

            <ArrowRight
              :size="17"
              aria-hidden="true"
              class="shrink-0 text-line-strong transition group-hover:translate-x-0.5 group-hover:text-brand"
            />
          </RouterLink>
        </div>
      </LedgerSurface>
    </template>
  </section>
</template>
