<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import {
  ArrowRight,
  Building2,
  CalendarDays,
  ChartNoAxesCombined,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Download,
  Hash,
  Layers3,
  ReceiptText,
  Tags,
} from '@lucide/vue'
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
import { formatAmount, formatDate } from '@/lib/helpers'

const route = useRoute()
const router = useRouter()
const PAGE_SIZE = 4

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

const hasExpenses = computed(() => (report.value?.expenses.items.length ?? 0) > 0)
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

async function loadReport(includeInsights: boolean) {
  try {
    error.value = ''
    dateRangeError.value = ''

    const requestedPage = readPageQuery()
    const filters = {
      dateFrom: dateFrom.value,
      dateTo: dateTo.value,
    }
    const comparisonFilters =
      dateFrom.value && dateTo.value ? { dateFrom: dateFrom.value, dateTo: dateTo.value } : null
    const [reportResponse, insightsResponse, categoryComparisonResponse] = await Promise.all([
      fetchExpenseReport({
        ...filters,
        page: requestedPage,
        pageSize: PAGE_SIZE,
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

    const lastPage = Math.max(result.data.expenses.pagination.totalPages, 1)
    if (requestedPage > lastPage) {
      await changePage(lastPage)
      return
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
  () => [dateFrom.value, dateTo.value, readPageQuery()] as const,
  ([nextDateFrom, nextDateTo], [previousDateFrom, previousDateTo]) => {
    loading.value = true
    const dateRangeChanged = nextDateFrom !== previousDateFrom || nextDateTo !== previousDateTo
    void loadReport(dateRangeChanged)
  },
)

onMounted(() => loadReport(true))
</script>

<template>
  <section class="space-y-7">
    <header>
      <p class="text-xs font-semibold uppercase tracking-[0.24em] text-accent">Analysis</p>
      <div>
        <h2 class="mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Expense report
        </h2>
        <p class="mt-2 max-w-2xl text-sm leading-6 text-ink-muted sm:text-base">
          Turn expense history into a clearer view of trends, vendors, and categories.
        </p>
      </div>
    </header>

    <fieldset
      class="rounded-2xl border border-line bg-surface px-4 py-3 shadow-card sm:flex sm:items-end sm:gap-3"
    >
      <legend class="sr-only">Report date range</legend>

      <div class="mb-3 flex items-center gap-2 sm:mb-0 sm:mr-auto sm:self-center">
        <span class="flex size-9 items-center justify-center rounded-xl bg-brand-soft text-brand">
          <CalendarDays :size="17" aria-hidden="true" />
        </span>
        <div>
          <p class="text-sm font-semibold text-ink">Reporting period</p>
          <p class="text-xs text-ink-muted">
            {{ dateFrom || dateTo ? 'Custom date range' : 'All recorded expenses' }}
          </p>
        </div>
      </div>

      <div class="grid gap-3 sm:flex sm:items-end">
        <div class="flex flex-col gap-1.5">
          <label for="report-date-from" class="text-xs font-medium text-ink-muted">From</label>
          <input
            id="report-date-from"
            :value="dateFrom"
            type="date"
            :aria-describedby="dateRangeError ? 'report-date-range-error' : undefined"
            :aria-invalid="Boolean(dateRangeError)"
            class="min-h-10 rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink outline-none transition hover:border-line-strong focus:border-brand"
            @change="
              updateDateRange({
                dateFrom: ($event.target as HTMLInputElement).value || undefined,
                dateTo: dateTo,
              })
            "
          />
        </div>

        <div class="flex flex-col gap-1.5">
          <label for="report-date-to" class="text-xs font-medium text-ink-muted">To</label>
          <input
            id="report-date-to"
            :value="dateTo"
            type="date"
            :aria-describedby="dateRangeError ? 'report-date-range-error' : undefined"
            :aria-invalid="Boolean(dateRangeError)"
            class="min-h-10 rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink outline-none transition hover:border-line-strong focus:border-brand"
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
          class="min-h-10 rounded-xl px-3 text-sm font-medium text-ink-muted transition hover:bg-surface-muted hover:text-ink"
          @click="updateDateRange({ dateFrom: undefined, dateTo: undefined })"
        >
          Clear
        </button>

        <button
          type="button"
          :disabled="exporting"
          class="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-white transition hover:bg-brand-strong disabled:cursor-not-allowed disabled:bg-line-strong"
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

    <section v-if="loading" class="space-y-4" role="status" aria-label="Loading expense report">
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
      v-else-if="error"
      role="alert"
      class="rounded-2xl border border-danger/25 bg-danger-soft px-5 py-4 text-sm text-danger"
    >
      <p class="font-medium">Could not load expense report</p>
      <p :id="dateRangeError ? 'report-date-range-error' : undefined" class="mt-1">
        {{ error }}
      </p>
    </section>

    <template v-else-if="report">
      <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Report overview">
        <article
          class="relative overflow-hidden rounded-2xl bg-brand-strong p-5 text-white shadow-lifted"
        >
          <div
            class="absolute -right-8 -top-10 size-28 rounded-full border-[20px] border-white/5"
            aria-hidden="true"
          />
          <span class="flex size-10 items-center justify-center rounded-xl bg-white/10">
            <CircleDollarSign :size="20" aria-hidden="true" />
          </span>
          <p class="mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-white/55">
            Total amount
          </p>
          <p class="mt-1 text-3xl font-semibold tracking-tight">
            ${{ formatAmount(report.totalAmount) }}
          </p>
        </article>

        <article class="rounded-2xl border border-line bg-surface p-5 shadow-card">
          <span
            class="flex size-10 items-center justify-center rounded-xl bg-brand-soft text-brand"
          >
            <Hash :size="20" aria-hidden="true" />
          </span>
          <p class="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted">
            Expense count
          </p>
          <p class="mt-1 text-3xl font-semibold tracking-tight text-ink">
            {{ report.expenseCount }}
          </p>
        </article>

        <article class="rounded-2xl border border-line bg-surface p-5 shadow-card">
          <span
            class="flex size-10 items-center justify-center rounded-xl bg-accent-soft text-accent"
          >
            <Layers3 :size="20" aria-hidden="true" />
          </span>
          <p class="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted">
            Categories
          </p>
          <p class="mt-1 text-3xl font-semibold tracking-tight text-ink">
            {{ report.categoryTotals.length }}
          </p>
        </article>
      </section>

      <section class="rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-6">
        <div class="flex items-start gap-3">
          <span
            class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent"
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

        <div
          v-if="!hasCompleteDateRange"
          class="mt-6 rounded-2xl bg-surface-muted px-5 py-10 text-center"
        >
          <p class="text-sm font-medium text-ink-muted">
            Select both dates to compare category spending.
          </p>
        </div>

        <template v-else-if="categoryComparison">
          <div class="mt-6 grid gap-3 sm:grid-cols-2">
            <article class="rounded-2xl border border-brand/15 bg-brand-soft/45 px-4 py-4">
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

            <article class="rounded-2xl border border-line bg-surface-muted px-4 py-4">
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
            class="mt-6 rounded-2xl border border-dashed border-line bg-surface-muted px-5 py-10 text-center"
          >
            <p class="text-sm font-medium text-ink">No category activity to compare</p>
          </div>

          <div v-else class="mt-6 max-h-[32rem] space-y-3 overflow-y-auto pr-1">
            <div
              v-for="category in categoryComparison.categories"
              :key="category.categoryId ?? category.categoryName"
              class="grid gap-3 rounded-xl border-b border-line px-1 py-4 last:border-b-0 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center"
            >
              <p class="text-sm font-semibold text-ink">{{ category.categoryName }}</p>
              <p class="text-xs text-ink-muted">
                Current
                <span class="font-semibold text-ink">
                  ${{ formatAmount(category.currentAmount) }}
                </span>
              </p>
              <p class="text-xs text-ink-muted">
                Previous
                <span class="font-semibold text-ink">
                  ${{ formatAmount(category.previousAmount) }}
                </span>
              </p>
              <p class="text-xs text-ink-muted">
                Change
                <span class="font-semibold text-ink">
                  ${{ formatAmount(category.changeAmount) }}
                  <template v-if="category.changePercentage === null"> · New</template>
                  <template v-else> · {{ category.changePercentage }}%</template>
                </span>
              </p>
            </div>
          </div>
        </template>
      </section>

      <div class="grid gap-5 xl:grid-cols-[0.85fr_1.25fr]">
        <section class="rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-6">
          <h3 class="text-lg font-semibold tracking-tight text-ink">Monthly spending</h3>
          <p class="mt-1 text-sm text-ink-muted">
            Spending totals by calendar month for the current report period.
          </p>

          <div
            v-if="!insights?.monthlyTotals.length"
            class="mt-6 rounded-2xl border border-dashed border-line bg-surface-muted px-5 py-10 text-center"
          >
            <p class="text-sm font-medium text-ink">No monthly totals</p>
          </div>

          <div v-else class="mt-6 max-h-[32rem] space-y-3 overflow-y-auto pr-1">
            <div
              v-for="month in visibleMonthlyTotals"
              :key="month.month"
              class="flex items-start justify-between gap-4 rounded-xl bg-surface-muted px-4 py-4"
            >
              <div>
                <p class="text-sm font-semibold text-ink">{{ month.month }}</p>
                <p class="mt-1 text-xs text-ink-muted">
                  {{ month.expenseCount }} expense{{ month.expenseCount === 1 ? '' : 's' }}
                </p>
              </div>
              <span class="shrink-0 text-sm font-semibold text-ink">
                ${{ formatAmount(month.totalAmount) }}
              </span>
            </div>
          </div>
        </section>

        <section class="rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-6">
          <div class="flex items-start gap-3">
            <span
              class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand"
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
            class="mt-6 rounded-2xl border border-dashed border-line bg-surface-muted px-5 py-10 text-center"
          >
            <p class="text-sm font-medium text-ink">No vendor totals</p>
          </div>

          <div v-else class="mt-6 space-y-3">
            <div
              v-for="vendor in visibleVendorTotals"
              :key="vendor.vendorId"
              class="flex items-start justify-between gap-4 border-b border-line px-1 py-4 last:border-b-0"
            >
              <div>
                <p class="text-sm font-semibold text-ink">{{ vendor.vendorName }}</p>
                <p class="mt-1 text-xs text-ink-muted">
                  {{ vendor.expenseCount }} expense{{ vendor.expenseCount === 1 ? '' : 's' }}
                </p>
              </div>
              <span class="shrink-0 text-sm font-semibold text-ink">
                ${{ formatAmount(vendor.totalAmount) }}
              </span>
            </div>
          </div>
        </section>

        <section class="rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-6">
          <div class="flex items-start gap-3">
            <span
              class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent"
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
            class="mt-6 rounded-2xl border border-dashed border-line bg-surface-muted px-5 py-10 text-center"
          >
            <p class="text-sm font-medium text-ink">No category totals</p>
            <p class="mt-2 text-sm text-ink-muted">
              Matching categorized expenses will appear here.
            </p>
          </div>

          <div v-else class="mt-6 space-y-3">
            <div
              v-for="category in visibleCategoryTotals"
              :key="category.categoryId ?? category.categoryName"
              class="rounded-xl bg-surface-muted px-4 py-4"
            >
              <div class="flex items-start justify-between gap-4">
                <div>
                  <p class="text-sm font-semibold text-ink">
                    {{ category.categoryName }}
                  </p>
                  <p class="mt-1 text-xs text-ink-muted">
                    {{ category.expenseCount }} expense{{ category.expenseCount === 1 ? '' : 's' }}
                  </p>
                </div>

                <span class="shrink-0 text-sm font-semibold text-ink">
                  ${{ formatAmount(category.totalAmount) }}
                </span>
              </div>
            </div>
          </div>
        </section>

        <section class="rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-6">
          <div class="flex items-start gap-3">
            <span
              class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand"
            >
              <ReceiptText :size="19" aria-hidden="true" />
            </span>
            <div>
              <h3 class="text-lg font-semibold tracking-tight text-ink">Expense rows</h3>
              <p class="mt-1 text-sm text-ink-muted">
                Detailed active expenses for the selected report period.
              </p>
            </div>
          </div>

          <div
            v-if="!hasExpenses"
            class="mt-6 rounded-2xl border border-dashed border-line bg-surface-muted px-5 py-10 text-center"
          >
            <p class="text-sm font-medium text-ink">No matching expenses</p>
            <p class="mt-2 text-sm text-ink-muted">
              Try broadening the date range to include more expense records.
            </p>
          </div>

          <div v-else class="mt-6 space-y-3">
            <RouterLink
              v-for="expense in report.expenses.items"
              :key="expense.id"
              :to="`/expenses/${expense.id}`"
              class="group flex items-center justify-between gap-4 border-b border-line px-1 py-4 transition last:border-b-0 hover:bg-surface-muted/45"
            >
              <div class="min-w-0">
                <p class="text-sm font-semibold text-ink">
                  {{ expense.description }}
                </p>
                <div class="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
                  <span>{{ expense.vendorName }}</span>
                  <span>{{ expense.categoryName }}</span>
                  <span>{{ formatDate(expense.expenseDate) }}</span>
                </div>
                <p v-if="expense.notes" class="mt-2 text-xs text-ink-muted">
                  {{ expense.notes }}
                </p>
              </div>

              <span class="inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-ink">
                ${{ formatAmount(expense.amount) }}
                <ArrowRight
                  :size="15"
                  aria-hidden="true"
                  class="text-line-strong transition group-hover:text-brand"
                />
              </span>
            </RouterLink>
          </div>

          <nav
            v-if="report.expenses.pagination.totalPages > 1"
            aria-label="Report expense pagination"
            class="mt-6 flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <p class="text-sm text-ink-muted">
              Page {{ report.expenses.pagination.page }} of
              {{ report.expenses.pagination.totalPages }} ·
              {{ report.expenses.pagination.totalItems }} expenses
            </p>

            <div class="flex gap-2">
              <button
                type="button"
                :disabled="report.expenses.pagination.page === 1"
                class="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-line bg-surface px-3 text-sm font-medium text-ink-muted transition hover:border-line-strong hover:text-ink disabled:cursor-not-allowed disabled:text-line-strong"
                @click="changePage(report.expenses.pagination.page - 1)"
              >
                <ChevronLeft :size="15" aria-hidden="true" />
                Previous
              </button>
              <button
                type="button"
                :disabled="
                  report.expenses.pagination.page === report.expenses.pagination.totalPages
                "
                class="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-line bg-surface px-3 text-sm font-medium text-ink-muted transition hover:border-line-strong hover:text-ink disabled:cursor-not-allowed disabled:text-line-strong"
                @click="changePage(report.expenses.pagination.page + 1)"
              >
                Next
                <ChevronRight :size="15" aria-hidden="true" />
              </button>
            </div>
          </nav>
        </section>
      </div>
    </template>
  </section>
</template>
