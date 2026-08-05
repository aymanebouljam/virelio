<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { ApiError } from '@/lib/api'
import { fetchExpenseReport } from '@/lib/reports/api'
import { expenseReportSchema, type ExpenseReport } from '@/lib/reports/schema'
import { formatAmount, formatDate } from '@/lib/helpers'

const route = useRoute()
const router = useRouter()

const report = ref<ExpenseReport | null>(null)
const loading = ref(true)
const error = ref('')

const dateFrom = computed(() => {
  const value = route.query.dateFrom
  return typeof value === 'string' ? value : undefined
})

const dateTo = computed(() => {
  const value = route.query.dateTo
  return typeof value === 'string' ? value : undefined
})

const hasExpenses = computed(() => (report.value?.expenses.length ?? 0) > 0)
const hasCategoryTotals = computed(() => (report.value?.categoryTotals.length ?? 0) > 0)

async function loadReport() {
  try {
    error.value = ''

    const result = expenseReportSchema.safeParse(
      await fetchExpenseReport({
        dateFrom: dateFrom.value,
        dateTo: dateTo.value,
      }),
    )

    if (!result.success) {
      error.value = 'Failed to validate expense report'
      return
    }

    report.value = result.data
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.content && typeof err.content.dateRange === 'string') {
        error.value = err.content.dateRange
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
    void loadReport()
  },
)

onMounted(loadReport)
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

    <section
      class="flex flex-col gap-3 rounded-3xl border border-stone-200 bg-white p-4 shadow-sm sm:flex-row sm:flex-wrap sm:items-end"
    >
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
    </section>

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
      class="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700"
    >
      <p class="font-medium">Could not load expense report</p>
      <p class="mt-1">{{ error }}</p>
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

      <div class="grid gap-6 xl:grid-cols-[0.85fr_1.25fr]">
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
              v-for="category in report.categoryTotals"
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
              v-for="expense in report.expenses"
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
        </section>
      </div>
    </template>
  </section>
</template>
