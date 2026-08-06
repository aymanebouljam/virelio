<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { ApiError } from '@/lib/api'
import { fetchDashboardSummary } from '@/lib/dashboard/api'
import { formatAmount, formatDate } from '@/lib/helpers'
import { dashboardSummarySchema, type DashboardSummary } from '@/lib/dashboard/schema'

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
  <section class="space-y-8">
    <header class="space-y-3">
      <p class="text-xs font-semibold uppercase tracking-[0.24em] text-stone-400">Dashboard</p>

      <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 class="text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">
            Spending at a glance
          </h2>
          <p class="mt-2 max-w-2xl text-sm leading-6 text-stone-500 sm:text-base">
            Monitor spend, category distribution, and recent expense activity from one view.
          </p>
        </div>
      </div>
    </header>

    <fieldset
      class="flex flex-col gap-3 rounded-3xl border border-stone-200 bg-white p-4 shadow-sm sm:flex-row sm:flex-wrap sm:items-end"
    >
      <legend class="sr-only">Dashboard date range</legend>

      <div class="flex flex-col gap-2">
        <label
          for="dashboard-date-from"
          class="text-xs font-medium uppercase tracking-[0.18em] text-stone-400"
        >
          From
        </label>
        <input
          id="dashboard-date-from"
          :value="dateFrom"
          type="date"
          :aria-describedby="dateRangeError ? 'dashboard-date-range-error' : undefined"
          :aria-invalid="Boolean(dateRangeError)"
          class="min-h-11 rounded-2xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700 outline-none transition focus:border-stone-400"
          @change="
            updateDateRange({
              dateFrom: ($event.target as HTMLInputElement).value,
              dateTo: dateTo,
            })
          "
        />
      </div>

      <div class="flex flex-col gap-2">
        <label
          for="dashboard-date-to"
          class="text-xs font-medium uppercase tracking-[0.18em] text-stone-400"
        >
          To
        </label>
        <input
          id="dashboard-date-to"
          :value="dateTo"
          type="date"
          :aria-describedby="dateRangeError ? 'dashboard-date-range-error' : undefined"
          :aria-invalid="Boolean(dateRangeError)"
          class="min-h-11 rounded-2xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700 outline-none transition focus:border-stone-400"
          @change="
            updateDateRange({
              dateFrom: dateFrom,
              dateTo: ($event.target as HTMLInputElement).value,
            })
          "
        />
      </div>

      <div v-if="dateFrom || dateTo">
        <button
          type="button"
          class="inline-flex min-h-11 items-center justify-center rounded-2xl border border-stone-200 bg-stone-50 px-4 py-2 text-sm font-medium text-stone-600 transition hover:border-stone-300 hover:bg-stone-100 hover:text-stone-900"
          @click="updateDateRange({ dateFrom: undefined, dateTo: undefined })"
        >
          Clear
        </button>
      </div>
    </fieldset>

    <div
      v-if="loading"
      class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      role="status"
      aria-label="Loading dashboard"
    >
      <div
        v-for="index in 4"
        :key="index"
        class="h-36 animate-pulse rounded-3xl border border-stone-200 bg-stone-100"
      />
    </div>

    <section
      v-else-if="error"
      role="alert"
      class="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700"
    >
      <p class="font-medium">Could not load dashboard</p>
      <p :id="dateRangeError ? 'dashboard-date-range-error' : undefined" class="mt-1">
        {{ error }}
      </p>
    </section>

    <template v-else-if="summary">
      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article class="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
          <p class="text-xs font-semibold uppercase tracking-[0.22em] text-stone-400">
            Total spend
          </p>
          <p class="mt-4 text-3xl font-semibold tracking-tight text-stone-900">
            ${{ formatAmount(summary.totalSpend) }}
          </p>
          <p class="mt-2 text-sm text-stone-500">Across all active recorded expenses.</p>
        </article>

        <article class="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
          <p class="text-xs font-semibold uppercase tracking-[0.22em] text-stone-400">
            Active vendors
          </p>
          <p class="mt-4 text-3xl font-semibold tracking-tight text-stone-900">
            {{ summary.activeVendors }}
          </p>
          <p class="mt-2 text-sm text-stone-500">Vendors available for new expense entries.</p>
        </article>

        <article class="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
          <p class="text-xs font-semibold uppercase tracking-[0.22em] text-stone-400">
            Uncategorized
          </p>
          <p class="mt-4 text-3xl font-semibold tracking-tight text-stone-900">
            {{ summary.uncategorizedExpenses }}
          </p>
          <p class="mt-2 text-sm text-stone-500">Expenses still waiting for category assignment.</p>
        </article>

        <article class="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
          <p class="text-xs font-semibold uppercase tracking-[0.22em] text-stone-400">
            Proof documents
          </p>
          <p class="mt-4 text-3xl font-semibold tracking-tight text-stone-900">
            {{ summary.proofDocuments }}
          </p>
          <p class="mt-2 text-sm text-stone-500">Uploaded receipts and invoices on file.</p>
        </article>
      </div>

      <div class="grid gap-6 xl:grid-cols-[1.25fr_0.85fr]">
        <section class="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
          <div class="flex items-start justify-between gap-4">
            <div>
              <h3 class="text-lg font-semibold tracking-tight text-stone-900">Recent activity</h3>
              <p class="mt-1 text-sm text-stone-500">
                The latest expense records and proof uploads across active expenses.
              </p>
            </div>
          </div>

          <div
            v-if="!hasRecentActivity"
            class="mt-6 rounded-2xl border border-dashed border-stone-200 bg-stone-50 px-5 py-10 text-center"
          >
            <p class="text-sm font-medium text-stone-600">No activity yet</p>
            <p class="mt-2 text-sm text-stone-500">
              Add expenses or upload proof documents to populate this activity stream.
            </p>
          </div>

          <div v-else class="mt-6 space-y-3">
            <RouterLink
              v-for="item in summary.recentActivity"
              :key="`${item.type}-${item.id}`"
              :to="`/expenses/${item.expenseId}`"
              class="flex items-start justify-between gap-4 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4 transition hover:border-stone-300 hover:bg-stone-100"
            >
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <p class="text-sm font-semibold text-stone-900">
                    {{ item.title }}
                  </p>
                  <span
                    class="inline-flex items-center rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-stone-500 ring-1 ring-stone-200"
                  >
                    {{ item.type === 'proof' ? 'Proof upload' : 'Expense' }}
                  </span>
                </div>

                <div class="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-500">
                  <span>{{ item.subtitle }}</span>
                  <span>{{ formatDate(item.occurredAt) }}</span>
                </div>
              </div>
            </RouterLink>
          </div>
        </section>

        <section class="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
          <h3 class="text-lg font-semibold tracking-tight text-stone-900">Category breakdown</h3>
          <p class="mt-1 text-sm text-stone-500">
            Spend distribution across active expense categories.
          </p>

          <div
            v-if="!hasCategoryBreakdown"
            class="mt-6 rounded-2xl border border-dashed border-stone-200 bg-stone-50 px-5 py-10 text-center"
          >
            <p class="text-sm font-medium text-stone-600">No category activity yet</p>
            <p class="mt-2 text-sm text-stone-500">
              Categorized expenses will appear here once recorded.
            </p>
          </div>

          <div v-else class="mt-6 space-y-3">
            <div
              v-for="category in summary.categoryBreakdown"
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
      </div>
    </template>
  </section>
</template>
