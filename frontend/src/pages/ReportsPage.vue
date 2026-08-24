<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Building2, CalendarDays, ChartNoAxesCombined, Download, Tags } from '@lucide/vue'
import { ApiError } from '@/lib/api'
import {
  downloadExpenseReportCsv,
  fetchCategoryComparison,
  fetchExpenseReport,
  fetchReportInsights,
} from '@/lib/reports/api'
import { summarizeCategoryTotals, summarizeVendorTotals } from '@/lib/reports/category-totals'
import {
  categoryComparisonSchema,
  expenseReportSchema,
  reportInsightsSchema,
  type CategoryComparison,
  type ExpenseReport,
  type ReportInsights,
} from '@/lib/reports/schema'
import { formatAmount } from '@/lib/helpers'
import LedgerSurface from '@/components/ui/LedgerSurface.vue'
import WorkspaceHeader from '@/components/ui/WorkspaceHeader.vue'

const route = useRoute()
const router = useRouter()
const MonthlySpendChart = defineAsyncComponent(
  () => import('@/components/reports/MonthlySpendChart.vue'),
)
const VendorSpendChart = defineAsyncComponent(
  () => import('@/components/reports/VendorSpendChart.vue'),
)
const CategoryComparisonChart = defineAsyncComponent(
  () => import('@/components/reports/CategoryComparisonChart.vue'),
)
const CategoryTotalsDonut = defineAsyncComponent(
  () => import('@/components/reports/CategoryTotalsDonut.vue'),
)

const report = ref<ExpenseReport | null>(null)
const insights = ref<ReportInsights | null>(null)
const categoryComparison = ref<CategoryComparison | null>(null)
const loading = ref(true)
const error = ref('')
const dateRangeError = ref('')
const exportError = ref('')
const exporting = ref(false)

const dateFrom = computed(() => {
  const value = route.query.dateFrom
  return typeof value === 'string' ? value : undefined
})

const dateTo = computed(() => {
  const value = route.query.dateTo
  return typeof value === 'string' ? value : undefined
})

const hasCompleteDateRange = computed(() => Boolean(dateFrom.value && dateTo.value))

const hasCategoryTotals = computed(() => (report.value?.categoryTotals.length ?? 0) > 0)
const visibleCategoryTotals = computed(() =>
  summarizeCategoryTotals(report.value?.categoryTotals ?? []),
)
const visibleMonthlyTotals = computed(() =>
  insights.value ? [...insights.value.monthlyTotals].reverse() : [],
)
const visibleVendorTotals = computed(() =>
  summarizeVendorTotals(insights.value?.vendorTotals ?? []),
)

async function loadReport(includeInsights: boolean) {
  try {
    error.value = ''
    dateRangeError.value = ''

    const filters = {
      dateFrom: dateFrom.value,
      dateTo: dateTo.value,
    }
    const comparisonFilters =
      dateFrom.value && dateTo.value ? { dateFrom: dateFrom.value, dateTo: dateTo.value } : null
    const [reportResponse, insightsResponse, categoryComparisonResponse] = await Promise.all([
      fetchExpenseReport({
        ...filters,
      }),
      includeInsights ? fetchReportInsights(filters) : Promise.resolve(null),
      includeInsights && comparisonFilters
        ? fetchCategoryComparison(comparisonFilters)
        : Promise.resolve(null),
    ])
    const result = expenseReportSchema.safeParse(reportResponse)

    if (!result.success) {
      error.value = 'Failed to validate expense report'
      return
    }

    if (insightsResponse) {
      const insightsResult = reportInsightsSchema.safeParse(insightsResponse)
      if (!insightsResult.success) {
        error.value = 'Failed to validate report insights'
        return
      }

      insights.value = insightsResult.data
    }

    if (includeInsights) {
      if (categoryComparisonResponse) {
        const comparisonResult = categoryComparisonSchema.safeParse(categoryComparisonResponse)
        if (!comparisonResult.success) {
          error.value = 'Failed to validate category comparison'
          return
        }

        categoryComparison.value = comparisonResult.data
      } else {
        categoryComparison.value = null
      }
    }

    report.value = result.data
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
  delete query.page

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

async function downloadCsv() {
  exportError.value = ''
  exporting.value = true

  try {
    const blob = await downloadExpenseReportCsv({
      dateFrom: dateFrom.value,
      dateTo: dateTo.value,
    })
    const objectUrl = URL.createObjectURL(blob)

    try {
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = 'virelio-expenses.csv'
      link.click()
    } finally {
      URL.revokeObjectURL(objectUrl)
    }
  } catch (err) {
    exportError.value = err instanceof ApiError ? err.message : 'Exporting expense report failed'
  } finally {
    exporting.value = false
  }
}

watch(
  () => [dateFrom.value, dateTo.value] as const,
  ([nextDateFrom, nextDateTo], [previousDateFrom, previousDateTo]) => {
    loading.value = true
    const dateRangeChanged = nextDateFrom !== previousDateFrom || nextDateTo !== previousDateTo
    void loadReport(dateRangeChanged)
  },
)

onMounted(() => loadReport(true))
</script>

<template>
  <section class="min-w-0 space-y-7">
    <WorkspaceHeader
      context="Analysis workspace"
      title="Read the patterns in your spending."
      description="Compare periods, follow the movement, and inspect the entries behind every total."
    />

    <fieldset
      class="min-w-0 max-w-full rounded-xl border border-line bg-surface-raised px-4 py-4 sm:flex sm:items-end sm:gap-3"
    >
      <legend class="sr-only">Report date range</legend>

      <div class="mb-3 flex items-center gap-2 sm:mb-0 sm:mr-auto sm:self-center">
        <span class="flex size-9 items-center justify-center rounded-lg bg-brand-soft text-brand">
          <CalendarDays :size="17" aria-hidden="true" />
        </span>
        <div>
          <p class="text-sm font-semibold text-ink">Reporting period</p>
          <p class="text-xs text-ink-muted">
            {{ dateFrom || dateTo ? 'Custom date range' : 'All recorded expenses' }}
          </p>
        </div>
      </div>

      <div class="grid min-w-0 gap-3 sm:flex sm:w-auto sm:items-end">
        <div class="flex min-w-0 flex-col gap-1.5">
          <label for="report-date-from" class="text-xs font-medium text-ink-muted">From</label>
          <input
            id="report-date-from"
            :value="dateFrom"
            type="date"
            :aria-describedby="dateRangeError ? 'report-date-range-error' : undefined"
            :aria-invalid="Boolean(dateRangeError)"
            class="min-h-10 w-full min-w-0 max-w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none transition hover:border-line-strong focus:border-brand sm:w-auto"
            @change="
              updateDateRange({
                dateFrom: ($event.target as HTMLInputElement).value || undefined,
                dateTo: dateTo,
              })
            "
          />
        </div>

        <div class="flex min-w-0 flex-col gap-1.5">
          <label for="report-date-to" class="text-xs font-medium text-ink-muted">To</label>
          <input
            id="report-date-to"
            :value="dateTo"
            type="date"
            :aria-describedby="dateRangeError ? 'report-date-range-error' : undefined"
            :aria-invalid="Boolean(dateRangeError)"
            class="min-h-10 w-full min-w-0 max-w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none transition hover:border-line-strong focus:border-brand sm:w-auto"
            @change="
              updateDateRange({
                dateFrom: dateFrom,
                dateTo: ($event.target as HTMLInputElement).value || undefined,
              })
            "
          />
        </div>

        <button
          v-if="dateFrom || dateTo"
          type="button"
          class="min-h-10 rounded-lg px-3 text-sm font-medium text-ink-muted transition hover:bg-surface-muted hover:text-ink"
          @click="updateDateRange({ dateFrom: undefined, dateTo: undefined })"
        >
          Clear
        </button>

        <button
          type="button"
          :disabled="exporting"
          class="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-white transition hover:bg-brand-strong disabled:cursor-not-allowed disabled:bg-line-strong"
          @click="downloadCsv"
        >
          <Download :size="16" aria-hidden="true" />
          {{ exporting ? 'Exporting...' : 'Export CSV' }}
        </button>
      </div>
    </fieldset>

    <p
      v-if="exportError"
      role="alert"
      class="rounded-2xl border border-danger/25 bg-danger-soft px-5 py-4 text-sm text-danger"
    >
      {{ exportError }}
    </p>

    <section
      v-if="loading && !report"
      class="space-y-4"
      role="status"
      aria-label="Loading expense report"
    >
      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div
          v-for="index in 3"
          :key="index"
          class="h-36 animate-pulse rounded-2xl border border-line bg-surface-muted"
        />
      </div>
      <div class="h-80 animate-pulse rounded-2xl border border-line bg-surface-muted" />
    </section>

    <section
      v-else-if="error && !report"
      role="alert"
      class="rounded-2xl border border-danger/25 bg-danger-soft px-5 py-4 text-sm text-danger"
    >
      <p class="font-medium">Could not load expense report</p>
      <p :id="dateRangeError ? 'report-date-range-error' : undefined" class="mt-1">
        {{ error }}
      </p>
    </section>

    <template v-else-if="report">
      <p
        v-if="loading"
        role="status"
        aria-live="polite"
        class="border-l-2 border-evidence bg-evidence-soft/45 px-4 py-3 text-sm text-ink-muted"
      >
        Updating report…
      </p>

      <section
        v-if="error"
        role="alert"
        class="border-l-2 border-danger bg-danger-soft px-4 py-3 text-sm text-danger"
      >
        <p class="font-medium">Could not update report</p>
        <p :id="dateRangeError ? 'report-date-range-error' : undefined" class="mt-1">
          {{ error }}
        </p>
      </section>

      <LedgerSurface
        tone="featured"
        class="relative grid overflow-hidden sm:grid-cols-[1.45fr_0.8fr_0.8fr]"
        aria-label="Report overview"
      >
        <span class="absolute inset-y-0 left-0 z-10 w-1 bg-evidence" aria-hidden="true" />
        <article class="relative min-w-0 overflow-hidden p-7 pl-8 text-white sm:p-9 sm:pl-10">
          <div
            class="absolute -right-10 -top-16 size-44 rounded-full border-[28px] border-white/5"
            aria-hidden="true"
          />
          <p class="relative text-xs font-semibold tracking-[0.14em] text-white/55">
            SPEND RECORDED
          </p>
          <p
            class="font-figure relative mt-3 break-words text-[clamp(2.25rem,5vw,4.5rem)] font-semibold leading-none tracking-[-0.06em]"
          >
            ${{ formatAmount(report.totalAmount) }}
          </p>
          <p class="relative mt-5 text-sm text-white/65">Across the selected reporting period.</p>
        </article>

        <article
          class="relative flex min-w-0 flex-col justify-center border-t border-white/15 p-7 sm:border-l sm:border-t-0 sm:p-8"
        >
          <span class="mb-5 h-px w-8 bg-evidence" aria-hidden="true" />
          <p class="font-figure text-4xl font-semibold tracking-[-0.05em] text-white">
            {{ report.expenseCount }}
          </p>
          <p class="mt-2 text-sm font-semibold text-white">Recorded expenses</p>
          <p class="mt-1 text-xs leading-5 text-white/55">Entries in this report.</p>
        </article>

        <article
          class="relative flex min-w-0 flex-col justify-center border-t border-white/15 p-7 sm:border-l sm:border-t-0 sm:p-8"
        >
          <span class="mb-5 h-px w-8 bg-white/35" aria-hidden="true" />
          <p class="font-figure text-4xl font-semibold tracking-[-0.05em] text-white">
            {{ report.categoryTotals.length }}
          </p>
          <p class="mt-2 text-sm font-semibold text-white">Categories represented</p>
          <p class="mt-1 text-xs leading-5 text-white/55">Where this period's spend is recorded.</p>
        </article>
      </LedgerSurface>

      <aside
        v-if="!hasCompleteDateRange"
        data-report-category-comparison-prompt
        class="border-l-2 border-evidence bg-evidence-soft/45 px-4 py-3 text-sm text-ink-muted"
      >
        Select both dates to compare category spending.
      </aside>

      <LedgerSurface v-else data-report-category-comparison class="p-5 sm:p-6">
        <div class="flex items-start gap-3">
          <span
            class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent"
          >
            <ChartNoAxesCombined :size="19" aria-hidden="true" />
          </span>
          <div>
            <h3 class="text-lg font-semibold tracking-tight text-ink">Category comparison</h3>
            <p class="mt-1 text-sm text-ink-muted">
              Compare the selected period with the immediately preceding period of the same length.
            </p>
          </div>
        </div>

        <template v-if="categoryComparison">
          <div class="mt-6 grid gap-3 sm:grid-cols-2">
            <article class="rounded-xl border border-brand/15 bg-brand-soft/45 px-4 py-4">
              <p class="text-xs font-semibold uppercase tracking-[0.18em] text-brand">
                Selected period
              </p>
              <p class="mt-2 text-sm text-ink-muted">
                {{ categoryComparison.currentPeriod.dateFrom }} to
                {{ categoryComparison.currentPeriod.dateTo }}
              </p>
              <p class="mt-3 text-xl font-semibold text-ink">
                ${{ formatAmount(categoryComparison.currentPeriod.totalAmount) }}
              </p>
            </article>

            <article class="rounded-xl border border-line bg-surface-muted px-4 py-4">
              <p class="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted">
                Previous period
              </p>
              <p class="mt-2 text-sm text-ink-muted">
                {{ categoryComparison.previousPeriod.dateFrom }} to
                {{ categoryComparison.previousPeriod.dateTo }}
              </p>
              <p class="mt-3 text-xl font-semibold text-ink">
                ${{ formatAmount(categoryComparison.previousPeriod.totalAmount) }}
              </p>
            </article>
          </div>

          <div
            v-if="categoryComparison.categories.length === 0"
            class="mt-6 rounded-xl border border-dashed border-line bg-surface-muted px-5 py-10 text-center"
          >
            <p class="text-sm font-medium text-ink">No category activity to compare</p>
          </div>

          <CategoryComparisonChart v-else class="mt-6" :comparison="categoryComparison" />
        </template>
      </LedgerSurface>

      <div class="grid min-w-0 gap-5 xl:grid-cols-2">
        <LedgerSurface data-report-monthly-spending class="p-5 sm:p-6 xl:col-span-2">
          <h3 class="text-lg font-semibold tracking-tight text-ink">Monthly spending</h3>
          <p class="mt-1 text-sm text-ink-muted">
            Spending totals by calendar month for the current report period.
          </p>

          <div
            v-if="!insights?.monthlyTotals.length"
            class="mt-6 rounded-xl border border-dashed border-line bg-surface-muted px-5 py-10 text-center"
          >
            <p class="text-sm font-medium text-ink">No monthly totals</p>
          </div>

          <MonthlySpendChart v-else class="mt-6" :monthly-totals="visibleMonthlyTotals" />
        </LedgerSurface>

        <LedgerSurface data-report-vendor-spending class="p-5 sm:flex sm:flex-col sm:p-6">
          <div class="flex items-start gap-3">
            <span
              class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand"
            >
              <Building2 :size="19" aria-hidden="true" />
            </span>
            <div>
              <h3 class="text-lg font-semibold tracking-tight text-ink">Vendor spending</h3>
              <p class="mt-1 text-sm text-ink-muted">
                Vendors ranked by total spend for the current report period.
              </p>
            </div>
          </div>

          <div
            v-if="!insights?.vendorTotals.length"
            class="mt-6 rounded-xl border border-dashed border-line bg-surface-muted px-5 py-10 text-center"
          >
            <p class="text-sm font-medium text-ink">No vendor totals</p>
          </div>

          <VendorSpendChart
            v-else
            class="mt-6 sm:min-h-0 sm:flex-1"
            :vendor-totals="visibleVendorTotals"
          />
        </LedgerSurface>

        <LedgerSurface data-report-category-totals class="p-5 sm:p-6">
          <div class="flex items-start gap-3">
            <span
              class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent"
            >
              <Tags :size="19" aria-hidden="true" />
            </span>
            <div>
              <h3 class="text-lg font-semibold tracking-tight text-ink">Category totals</h3>
              <p class="mt-1 text-sm text-ink-muted">
                Spend grouped by category for the current report period.
              </p>
            </div>
          </div>

          <div
            v-if="!hasCategoryTotals"
            class="mt-6 rounded-xl border border-dashed border-line bg-surface-muted px-5 py-10 text-center"
          >
            <p class="text-sm font-medium text-ink">No category totals</p>
            <p class="mt-2 text-sm text-ink-muted">
              Matching categorized expenses will appear here.
            </p>
          </div>

          <CategoryTotalsDonut v-else class="mt-6" :category-totals="visibleCategoryTotals" />
        </LedgerSurface>
      </div>
    </template>
  </section>
</template>
