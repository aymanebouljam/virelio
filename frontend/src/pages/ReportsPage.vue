<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { ApiError } from '@/lib/api'
import {
  downloadExpenseReportCsv,
  fetchCategoryComparison,
  fetchExpenseReport,
  fetchReportInsights,
} from '@/lib/reports/api'
import { summarizeCategoryTotals } from '@/lib/reports/category-totals'
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
  <section class="space-y-8">
    <header class="space-y-3">
      <p class="text-xs font-semibold uppercase tracking-[0.24em] text-stone-400">Reports</p>
      <div>
        <h2 class="text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">
          Expense report
        </h2>
        <p class="mt-2 max-w-2xl text-sm leading-6 text-stone-500 sm:text-base">
          Review expense totals, grouped category spend, and the detailed expense rows for a
          selected period.
        </p>
      </div>
    </header>

    <fieldset
      class="flex flex-col gap-3 rounded-3xl border border-stone-200 bg-white p-4 shadow-sm sm:flex-row sm:flex-wrap sm:items-end"
    >
      <legend class="sr-only">Report date range</legend>

      <div class="flex flex-col gap-2">
        <label
          for="report-date-from"
          class="text-xs font-medium uppercase tracking-[0.18em] text-stone-400"
        >
          From
        </label>
        <input
          id="report-date-from"
          :value="dateFrom"
          type="date"
          :aria-describedby="dateRangeError ? 'report-date-range-error' : undefined"
          :aria-invalid="Boolean(dateRangeError)"
          class="min-h-11 rounded-2xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700 outline-none transition focus:border-stone-400"
          @change="
            updateDateRange({
              dateFrom: ($event.target as HTMLInputElement).value || undefined,
              dateTo: dateTo,
            })
          "
        />
      </div>

      <div class="flex flex-col gap-2">
        <label
          for="report-date-to"
          class="text-xs font-medium uppercase tracking-[0.18em] text-stone-400"
        >
          To
        </label>
        <input
          id="report-date-to"
          :value="dateTo"
          type="date"
          :aria-describedby="dateRangeError ? 'report-date-range-error' : undefined"
          :aria-invalid="Boolean(dateRangeError)"
          class="min-h-11 rounded-2xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700 outline-none transition focus:border-stone-400"
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
        class="inline-flex min-h-11 items-center justify-center rounded-2xl border border-stone-200 bg-stone-50 px-4 py-2 text-sm font-medium text-stone-600 transition hover:border-stone-300 hover:bg-stone-100 hover:text-stone-900"
        @click="updateDateRange({ dateFrom: undefined, dateTo: undefined })"
      >
        Clear
      </button>

      <button
        type="button"
        :disabled="exporting"
        class="inline-flex min-h-11 items-center justify-center rounded-2xl bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:bg-stone-400"
        @click="downloadCsv"
      >
        {{ exporting ? 'Exporting...' : 'Export CSV' }}
      </button>
    </fieldset>

    <p
      v-if="exportError"
      role="alert"
      class="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700"
    >
      {{ exportError }}
    </p>

    <section v-if="loading" class="space-y-4" role="status" aria-label="Loading expense report">
      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div
          v-for="index in 3"
          :key="index"
          class="h-32 animate-pulse rounded-3xl border border-stone-200 bg-stone-100"
        />
      </div>
      <div class="h-80 animate-pulse rounded-3xl border border-stone-200 bg-stone-100" />
    </section>

    <section
      v-else-if="error"
      role="alert"
      class="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700"
    >
      <p class="font-medium">Could not load expense report</p>
      <p :id="dateRangeError ? 'report-date-range-error' : undefined" class="mt-1">
        {{ error }}
      </p>
    </section>

    <template v-else-if="report">
      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <article class="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
          <p class="text-xs font-semibold uppercase tracking-[0.22em] text-stone-400">
            Total amount
          </p>
          <p class="mt-4 text-3xl font-semibold tracking-tight text-stone-900">
            ${{ formatAmount(report.totalAmount) }}
          </p>
        </article>

        <article class="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
          <p class="text-xs font-semibold uppercase tracking-[0.22em] text-stone-400">
            Expense count
          </p>
          <p class="mt-4 text-3xl font-semibold tracking-tight text-stone-900">
            {{ report.expenseCount }}
          </p>
        </article>

        <article class="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
          <p class="text-xs font-semibold uppercase tracking-[0.22em] text-stone-400">Categories</p>
          <p class="mt-4 text-3xl font-semibold tracking-tight text-stone-900">
            {{ report.categoryTotals.length }}
          </p>
        </article>
      </div>

      <section class="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
        <h3 class="text-lg font-semibold tracking-tight text-stone-900">Category comparison</h3>
        <p class="mt-1 text-sm text-stone-500">
          Compare the selected period with the immediately preceding period of the same length.
        </p>

        <div
          v-if="!hasCompleteDateRange"
          class="mt-6 rounded-2xl border border-dashed border-stone-200 bg-stone-50 px-5 py-10 text-center"
        >
          <p class="text-sm font-medium text-stone-600">
            Select both dates to compare category spending.
          </p>
        </div>

        <template v-else-if="categoryComparison">
          <div class="mt-6 grid gap-3 sm:grid-cols-2">
            <article class="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4">
              <p class="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">
                Selected period
              </p>
              <p class="mt-2 text-sm text-stone-500">
                {{ categoryComparison.currentPeriod.dateFrom }} to
                {{ categoryComparison.currentPeriod.dateTo }}
              </p>
              <p class="mt-3 text-xl font-semibold text-stone-900">
                ${{ formatAmount(categoryComparison.currentPeriod.totalAmount) }}
              </p>
            </article>

            <article class="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4">
              <p class="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">
                Previous period
              </p>
              <p class="mt-2 text-sm text-stone-500">
                {{ categoryComparison.previousPeriod.dateFrom }} to
                {{ categoryComparison.previousPeriod.dateTo }}
              </p>
              <p class="mt-3 text-xl font-semibold text-stone-900">
                ${{ formatAmount(categoryComparison.previousPeriod.totalAmount) }}
              </p>
            </article>
          </div>

          <div
            v-if="categoryComparison.categories.length === 0"
            class="mt-6 rounded-2xl border border-dashed border-stone-200 bg-stone-50 px-5 py-10 text-center"
          >
            <p class="text-sm font-medium text-stone-600">No category activity to compare</p>
          </div>

          <div v-else class="mt-6 max-h-[32rem] space-y-3 overflow-y-auto pr-1">
            <div
              v-for="category in categoryComparison.categories"
              :key="category.categoryId ?? category.categoryName"
              class="grid gap-3 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center"
            >
              <p class="text-sm font-semibold text-stone-900">{{ category.categoryName }}</p>
              <p class="text-xs text-stone-500">
                Current
                <span class="font-semibold text-stone-900">
                  ${{ formatAmount(category.currentAmount) }}
                </span>
              </p>
              <p class="text-xs text-stone-500">
                Previous
                <span class="font-semibold text-stone-900">
                  ${{ formatAmount(category.previousAmount) }}
                </span>
              </p>
              <p class="text-xs text-stone-500">
                Change
                <span class="font-semibold text-stone-900">
                  ${{ formatAmount(category.changeAmount) }}
                  <template v-if="category.changePercentage === null"> · New</template>
                  <template v-else> · {{ category.changePercentage }}%</template>
                </span>
              </p>
            </div>
          </div>
        </template>
      </section>

      <div class="grid gap-6 xl:grid-cols-[0.85fr_1.25fr]">
        <section class="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
          <h3 class="text-lg font-semibold tracking-tight text-stone-900">Monthly spending</h3>
          <p class="mt-1 text-sm text-stone-500">
            Spending totals by calendar month for the current report period.
          </p>

          <div
            v-if="!insights?.monthlyTotals.length"
            class="mt-6 rounded-2xl border border-dashed border-stone-200 bg-stone-50 px-5 py-10 text-center"
          >
            <p class="text-sm font-medium text-stone-600">No monthly totals</p>
          </div>

          <div v-else class="mt-6 space-y-3">
            <div
              v-for="month in insights.monthlyTotals"
              :key="month.month"
              class="flex items-start justify-between gap-4 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4"
            >
              <div>
                <p class="text-sm font-semibold text-stone-900">{{ month.month }}</p>
                <p class="mt-1 text-xs text-stone-500">
                  {{ month.expenseCount }} expense{{ month.expenseCount === 1 ? '' : 's' }}
                </p>
              </div>
              <span class="shrink-0 text-sm font-semibold text-stone-900">
                ${{ formatAmount(month.totalAmount) }}
              </span>
            </div>
          </div>
        </section>

        <section class="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
          <h3 class="text-lg font-semibold tracking-tight text-stone-900">Vendor spending</h3>
          <p class="mt-1 text-sm text-stone-500">
            Vendors ranked by total spend for the current report period.
          </p>

          <div
            v-if="!insights?.vendorTotals.length"
            class="mt-6 rounded-2xl border border-dashed border-stone-200 bg-stone-50 px-5 py-10 text-center"
          >
            <p class="text-sm font-medium text-stone-600">No vendor totals</p>
          </div>

          <div v-else class="mt-6 space-y-3">
            <div
              v-for="vendor in insights.vendorTotals"
              :key="vendor.vendorId"
              class="flex items-start justify-between gap-4 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4"
            >
              <div>
                <p class="text-sm font-semibold text-stone-900">{{ vendor.vendorName }}</p>
                <p class="mt-1 text-xs text-stone-500">
                  {{ vendor.expenseCount }} expense{{ vendor.expenseCount === 1 ? '' : 's' }}
                </p>
              </div>
              <span class="shrink-0 text-sm font-semibold text-stone-900">
                ${{ formatAmount(vendor.totalAmount) }}
              </span>
            </div>
          </div>
        </section>

        <section class="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
          <h3 class="text-lg font-semibold tracking-tight text-stone-900">Category totals</h3>
          <p class="mt-1 text-sm text-stone-500">
            Spend grouped by category for the current report period.
          </p>

          <div
            v-if="!hasCategoryTotals"
            class="mt-6 rounded-2xl border border-dashed border-stone-200 bg-stone-50 px-5 py-10 text-center"
          >
            <p class="text-sm font-medium text-stone-600">No category totals</p>
            <p class="mt-2 text-sm text-stone-500">
              Matching categorized expenses will appear here.
            </p>
          </div>

          <div v-else class="mt-6 space-y-3">
            <div
              v-for="category in visibleCategoryTotals"
              :key="category.categoryId ?? category.categoryName"
              class="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4"
            >
              <div class="flex items-start justify-between gap-4">
                <div>
                  <p class="text-sm font-semibold text-stone-900">
                    {{ category.categoryName }}
                  </p>
                  <p class="mt-1 text-xs text-stone-500">
                    {{ category.expenseCount }} expense{{ category.expenseCount === 1 ? '' : 's' }}
                  </p>
                </div>

                <span class="shrink-0 text-sm font-semibold text-stone-900">
                  ${{ formatAmount(category.totalAmount) }}
                </span>
              </div>
            </div>
          </div>
        </section>

        <section class="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
          <h3 class="text-lg font-semibold tracking-tight text-stone-900">Expense rows</h3>
          <p class="mt-1 text-sm text-stone-500">
            Detailed active expenses for the selected report period.
          </p>

          <div
            v-if="!hasExpenses"
            class="mt-6 rounded-2xl border border-dashed border-stone-200 bg-stone-50 px-5 py-10 text-center"
          >
            <p class="text-sm font-medium text-stone-600">No matching expenses</p>
            <p class="mt-2 text-sm text-stone-500">
              Try broadening the date range to include more expense records.
            </p>
          </div>

          <div v-else class="mt-6 space-y-3">
            <RouterLink
              v-for="expense in report.expenses.items"
              :key="expense.id"
              :to="`/expenses/${expense.id}`"
              class="flex items-start justify-between gap-4 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4 transition hover:border-stone-300 hover:bg-stone-100"
            >
              <div class="min-w-0">
                <p class="text-sm font-semibold text-stone-900">
                  {{ expense.description }}
                </p>
                <div class="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-500">
                  <span>{{ expense.vendorName }}</span>
                  <span>{{ expense.categoryName }}</span>
                  <span>{{ formatDate(expense.expenseDate) }}</span>
                </div>
                <p v-if="expense.notes" class="mt-2 text-xs text-stone-500">
                  {{ expense.notes }}
                </p>
              </div>

              <span class="shrink-0 text-sm font-semibold text-stone-900">
                ${{ formatAmount(expense.amount) }}
              </span>
            </RouterLink>
          </div>

          <nav
            v-if="report.expenses.pagination.totalPages > 1"
            aria-label="Report expense pagination"
            class="mt-6 flex flex-col gap-3 border-t border-stone-200 pt-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <p class="text-sm text-stone-500">
              Page {{ report.expenses.pagination.page }} of
              {{ report.expenses.pagination.totalPages }} ·
              {{ report.expenses.pagination.totalItems }} expenses
            </p>

            <div class="flex gap-2">
              <button
                type="button"
                :disabled="report.expenses.pagination.page === 1"
                class="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-600 transition hover:border-stone-300 hover:text-stone-900 disabled:cursor-not-allowed disabled:text-stone-300"
                @click="changePage(report.expenses.pagination.page - 1)"
              >
                Previous
              </button>
              <button
                type="button"
                :disabled="
                  report.expenses.pagination.page === report.expenses.pagination.totalPages
                "
                class="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-600 transition hover:border-stone-300 hover:text-stone-900 disabled:cursor-not-allowed disabled:text-stone-300"
                @click="changePage(report.expenses.pagination.page + 1)"
              >
                Next
              </button>
            </div>
          </nav>
        </section>
      </div>
    </template>
  </section>
</template>
