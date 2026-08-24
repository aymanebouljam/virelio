<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import {
  ArrowRight,
  Building2,
  CalendarDays,
  CircleDollarSign,
  FileText,
  Plus,
  ReceiptText,
  Tags,
} from '@lucide/vue'
import { ApiError } from '@/lib/api'
import { fetchDashboardSummary } from '@/lib/dashboard/api'
import { formatAmount, formatDate } from '@/lib/helpers'
import { dashboardSummarySchema, type DashboardSummary } from '@/lib/dashboard/schema'

const route = useRoute()
const router = useRouter()
const CategorySpendChart = defineAsyncComponent(
  () => import('@/components/dashboard/CategorySpendChart.vue'),
)

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
const hasCategoryBreakdown = computed(() => (summary.value?.categoryBreakdown.length ?? 0) > 0)
const hasRecentActivity = computed(() => (summary.value?.recentActivity.length ?? 0) > 0)

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
    <header
      class="flex flex-col gap-5 border-b border-line pb-6 lg:flex-row lg:items-end lg:justify-between"
    >
      <div>
        <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
          Ledger snapshot
        </p>
        <h1
          class="font-display mt-2 text-[2rem] font-semibold leading-tight tracking-[-0.035em] text-ink sm:text-[2.5rem]"
        >
          Follow the record, not the noise.
        </h1>
        <p class="mt-2 max-w-2xl text-sm leading-6 text-ink-muted sm:text-[15px]">
          Review spend, supporting proof, and the entries that need attention.
        </p>
      </div>

      <RouterLink
        to="/expenses"
        class="inline-flex min-h-11 w-fit items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-white transition hover:bg-brand-strong"
      >
        <Plus :size="17" aria-hidden="true" />
        Manage expenses
      </RouterLink>
    </header>

    <fieldset
      class="grid gap-4 rounded-xl border border-line bg-surface px-4 py-4 shadow-card lg:grid-cols-[1fr_auto] lg:items-end"
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
      v-if="loading"
      class="grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2 xl:grid-cols-4"
      role="status"
      aria-label="Loading dashboard"
    >
      <div v-for="index in 4" :key="index" class="h-36 animate-pulse bg-surface-muted/70" />
    </div>

    <section
      v-else-if="error"
      role="alert"
      class="rounded-xl border border-danger/25 bg-danger-soft px-5 py-4 text-sm text-danger"
    >
      <p class="font-medium">Could not load dashboard</p>
      <p :id="dateRangeError ? 'dashboard-date-range-error' : undefined" class="mt-1">
        {{ error }}
      </p>
    </section>

    <template v-else-if="summary">
      <section
        class="grid overflow-hidden rounded-xl border border-line bg-surface shadow-card sm:grid-cols-2 xl:grid-cols-4"
        aria-label="Spending overview"
      >
        <article
          data-summary-metric="total-spend"
          class="relative border-b border-line p-5 sm:border-r xl:border-b-0"
        >
          <span class="absolute inset-y-0 left-0 w-1 bg-accent" aria-hidden="true" />
          <div class="flex items-start justify-between gap-4">
            <div>
              <p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
                Total spend
              </p>
              <p class="font-figure mt-3 text-[1.75rem] font-semibold tracking-[-0.04em] text-ink">
                ${{ formatAmount(summary.totalSpend) }}
              </p>
            </div>
            <span
              class="flex size-9 items-center justify-center rounded-lg bg-accent-soft text-accent"
            >
              <CircleDollarSign :size="18" :stroke-width="1.8" aria-hidden="true" />
            </span>
          </div>
          <p class="mt-4 text-xs text-ink-muted">
            {{ hasDateRange ? 'Within the selected period' : 'Across active expenses' }}
          </p>
        </article>

        <article
          data-summary-metric="active-vendors"
          class="border-b border-line p-5 xl:border-b-0 xl:border-r"
        >
          <div class="flex items-start justify-between gap-4">
            <div>
              <p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
                Active vendors
              </p>
              <p class="font-figure mt-3 text-[1.75rem] font-semibold tracking-[-0.04em] text-ink">
                {{ summary.activeVendors }}
              </p>
            </div>
            <span
              class="flex size-9 items-center justify-center rounded-lg bg-brand-soft text-brand"
            >
              <Building2 :size="18" :stroke-width="1.8" aria-hidden="true" />
            </span>
          </div>
          <RouterLink
            to="/vendors"
            class="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-brand hover:text-brand-strong"
          >
            View vendor ledger
            <ArrowRight :size="14" aria-hidden="true" />
          </RouterLink>
        </article>

        <article
          data-summary-metric="uncategorized"
          class="border-b border-line p-5 sm:border-b-0 sm:border-r"
        >
          <div class="flex items-start justify-between gap-4">
            <div>
              <p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
                Uncategorized
              </p>
              <p class="font-figure mt-3 text-[1.75rem] font-semibold tracking-[-0.04em] text-ink">
                {{ summary.uncategorizedExpenses }}
              </p>
            </div>
            <span
              class="flex size-9 items-center justify-center rounded-lg bg-warning-soft text-warning"
            >
              <Tags :size="18" :stroke-width="1.8" aria-hidden="true" />
            </span>
          </div>
          <RouterLink
            to="/expenses"
            class="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-brand hover:text-brand-strong"
          >
            Review entries
            <ArrowRight :size="14" aria-hidden="true" />
          </RouterLink>
        </article>

        <article data-summary-metric="proof-documents" class="p-5">
          <div class="flex items-start justify-between gap-4">
            <div>
              <p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
                Proof documents
              </p>
              <p class="font-figure mt-3 text-[1.75rem] font-semibold tracking-[-0.04em] text-ink">
                {{ summary.proofDocuments }}
              </p>
            </div>
            <span
              class="flex size-9 items-center justify-center rounded-lg bg-surface-muted text-ink-muted"
            >
              <FileText :size="18" :stroke-width="1.8" aria-hidden="true" />
            </span>
          </div>
          <p class="mt-4 text-xs text-ink-muted">Files attached to expense records</p>
        </article>
      </section>

      <div class="grid min-w-0 gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <section
          data-dashboard-recent-activity
          class="min-w-0 overflow-hidden rounded-xl border border-line bg-surface shadow-card"
        >
          <header
            class="flex flex-col items-start gap-3 border-b border-line px-4 py-4 sm:flex-row sm:justify-between sm:px-6"
          >
            <div>
              <p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
                Evidence trail
              </p>
              <h2 class="font-display mt-1 text-lg font-semibold tracking-[-0.02em] text-ink">
                Recent activity
              </h2>
              <p class="mt-1 text-sm text-ink-muted">Latest changes to expenses and proof.</p>
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
        </section>

        <section
          data-dashboard-category-spend
          class="min-w-0 rounded-xl border border-line bg-surface p-4 shadow-card sm:p-6"
        >
          <div class="border-b border-line pb-4">
            <p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
              Distribution
            </p>
            <h2 class="font-display mt-1 text-lg font-semibold tracking-[-0.02em] text-ink">
              Spend by category
            </h2>
            <p class="mt-1 text-sm text-ink-muted">Where recorded spend is concentrated.</p>
          </div>

          <div v-if="!hasCategoryBreakdown" class="py-12 text-center">
            <span
              class="mx-auto flex size-11 items-center justify-center rounded-lg bg-accent-soft text-accent"
            >
              <Tags :size="22" :stroke-width="1.7" aria-hidden="true" />
            </span>
            <p class="mt-4 text-sm font-semibold text-ink">No category activity yet</p>
            <p class="mx-auto mt-1 max-w-xs text-sm leading-6 text-ink-muted">
              Categorized expenses will reveal where your spending is concentrated.
            </p>
          </div>

          <CategorySpendChart
            v-else
            class="mt-5"
            :categories="summary.categoryBreakdown"
            :total-spend="summary.totalSpend"
          />
        </section>
      </div>
    </template>
  </section>
</template>
