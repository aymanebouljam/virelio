<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
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

function categoryShare(totalAmount: string) {
  const totalSpend = Number(summary.value?.totalSpend ?? 0)
  if (totalSpend <= 0) return 0

  return Math.min(100, Math.round((Number(totalAmount) / totalSpend) * 100))
}

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
  <section class="space-y-7">
    <header class="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p class="text-xs font-semibold uppercase tracking-[0.24em] text-accent">Overview</p>
        <h2 class="mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Your spending, clearly.
        </h2>
        <p class="mt-2 max-w-2xl text-sm leading-6 text-ink-muted sm:text-base">
          See where your money is going and what needs your attention.
        </p>
      </div>

      <RouterLink
        to="/expenses"
        class="inline-flex min-h-11 w-fit items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-white shadow-card transition hover:bg-brand-strong"
      >
        <Plus :size="17" aria-hidden="true" />
        Manage expenses
      </RouterLink>
    </header>

    <fieldset
      class="rounded-2xl border border-line bg-surface px-4 py-3 shadow-card sm:flex sm:items-end sm:gap-3"
    >
      <legend class="sr-only">Dashboard date range</legend>

      <div class="mb-3 flex items-center gap-2 sm:mb-0 sm:mr-auto sm:self-center">
        <span class="flex size-9 items-center justify-center rounded-xl bg-brand-soft text-brand">
          <CalendarDays :size="17" aria-hidden="true" />
        </span>
        <div>
          <p class="text-sm font-semibold text-ink">Reporting period</p>
          <p class="text-xs text-ink-muted">
            {{ hasDateRange ? 'Custom date range' : 'All recorded expenses' }}
          </p>
        </div>
      </div>

      <div class="grid gap-3 sm:flex sm:items-end">
        <div class="flex flex-col gap-1.5">
          <label for="dashboard-date-from" class="text-xs font-medium text-ink-muted">From</label>
          <input
            id="dashboard-date-from"
            :value="dateFrom"
            type="date"
            :aria-describedby="dateRangeError ? 'dashboard-date-range-error' : undefined"
            :aria-invalid="Boolean(dateRangeError)"
            class="min-h-10 rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition hover:border-stone-300 focus:border-brand"
            @change="
              updateDateRange({
                dateFrom: ($event.target as HTMLInputElement).value,
                dateTo: dateTo,
              })
            "
          />
        </div>

        <div class="flex flex-col gap-1.5">
          <label for="dashboard-date-to" class="text-xs font-medium text-ink-muted">To</label>
          <input
            id="dashboard-date-to"
            :value="dateTo"
            type="date"
            :aria-describedby="dateRangeError ? 'dashboard-date-range-error' : undefined"
            :aria-invalid="Boolean(dateRangeError)"
            class="min-h-10 rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition hover:border-stone-300 focus:border-brand"
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
          class="min-h-10 rounded-xl px-3 text-sm font-medium text-ink-muted transition hover:bg-surface-muted hover:text-ink"
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
        class="h-40 animate-pulse rounded-2xl border border-line bg-surface-muted"
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
      <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Spending overview">
        <article
          class="relative overflow-hidden rounded-2xl bg-brand-strong p-5 text-white shadow-lifted sm:col-span-2 xl:col-span-1"
        >
          <div
            class="absolute -right-10 -top-12 size-36 rounded-full border-[24px] border-white/5"
            aria-hidden="true"
          />
          <div class="relative">
            <span class="flex size-10 items-center justify-center rounded-xl bg-white/10">
              <CircleDollarSign :size="20" :stroke-width="1.8" aria-hidden="true" />
            </span>
            <p class="mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-white/55">
              Total spend
            </p>
            <p class="mt-1 text-3xl font-semibold tracking-tight">
              ${{ formatAmount(summary.totalSpend) }}
            </p>
            <p class="mt-2 text-xs text-white/55">
              {{ hasDateRange ? 'Within the selected period' : 'Across active expenses' }}
            </p>
          </div>
        </article>

        <article class="rounded-2xl border border-line bg-surface p-5 shadow-card">
          <span
            class="flex size-10 items-center justify-center rounded-xl bg-brand-soft text-brand"
          >
            <Building2 :size="20" :stroke-width="1.8" aria-hidden="true" />
          </span>
          <div class="mt-5 flex items-end justify-between gap-3">
            <div>
              <p class="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted">
                Active vendors
              </p>
              <p class="mt-1 text-3xl font-semibold tracking-tight text-ink">
                {{ summary.activeVendors }}
              </p>
            </div>
            <RouterLink
              to="/vendors"
              aria-label="View active vendors"
              class="flex size-9 items-center justify-center rounded-full text-ink-muted transition hover:bg-surface-muted hover:text-brand"
            >
              <ArrowRight :size="17" aria-hidden="true" />
            </RouterLink>
          </div>
        </article>

        <article class="rounded-2xl border border-line bg-surface p-5 shadow-card">
          <span
            class="flex size-10 items-center justify-center rounded-xl bg-accent-soft text-accent"
          >
            <Tags :size="20" :stroke-width="1.8" aria-hidden="true" />
          </span>
          <div class="mt-5 flex items-end justify-between gap-3">
            <div>
              <p class="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted">
                Uncategorized
              </p>
              <p class="mt-1 text-3xl font-semibold tracking-tight text-ink">
                {{ summary.uncategorizedExpenses }}
              </p>
            </div>
            <RouterLink
              to="/expenses"
              aria-label="Review uncategorized expenses"
              class="flex size-9 items-center justify-center rounded-full text-ink-muted transition hover:bg-surface-muted hover:text-brand"
            >
              <ArrowRight :size="17" aria-hidden="true" />
            </RouterLink>
          </div>
        </article>

        <article class="rounded-2xl border border-line bg-surface p-5 shadow-card">
          <span
            class="flex size-10 items-center justify-center rounded-xl bg-surface-muted text-ink-muted"
          >
            <FileText :size="20" :stroke-width="1.8" aria-hidden="true" />
          </span>
          <div class="mt-5">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted">
              Proof documents
            </p>
            <p class="mt-1 text-3xl font-semibold tracking-tight text-ink">
              {{ summary.proofDocuments }}
            </p>
          </div>
        </article>
      </section>

      <div class="grid gap-5 xl:grid-cols-[1.35fr_0.9fr]">
        <section class="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
          <header
            class="flex items-start justify-between gap-4 border-b border-line px-5 py-5 sm:px-6"
          >
            <div>
              <h3 class="text-lg font-semibold tracking-tight text-ink">Recent activity</h3>
              <p class="mt-1 text-sm text-ink-muted">Your latest expense and document updates.</p>
            </div>
            <RouterLink
              to="/expenses"
              class="hidden items-center gap-1.5 text-sm font-semibold text-brand hover:text-brand-strong sm:inline-flex"
            >
              View all
              <ArrowRight :size="15" aria-hidden="true" />
            </RouterLink>
          </header>

          <div v-if="!hasRecentActivity" class="px-5 py-12 text-center sm:px-6">
            <span
              class="mx-auto flex size-12 items-center justify-center rounded-2xl bg-brand-soft text-brand"
            >
              <ReceiptText :size="22" :stroke-width="1.7" aria-hidden="true" />
            </span>
            <p class="mt-4 text-sm font-semibold text-ink">No activity yet</p>
            <p class="mx-auto mt-1 max-w-sm text-sm leading-6 text-ink-muted">
              Record your first expense to start building a useful spending overview.
            </p>
            <RouterLink
              to="/expenses"
              class="mt-5 inline-flex min-h-10 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-strong"
            >
              <Plus :size="16" aria-hidden="true" />
              Add an expense
            </RouterLink>
          </div>

          <div v-else class="divide-y divide-line">
            <RouterLink
              v-for="item in summary.recentActivity"
              :key="`${item.type}-${item.id}`"
              :to="`/expenses/${item.expenseId}`"
              class="group flex items-center gap-4 px-5 py-4 transition hover:bg-surface-muted/55 sm:px-6"
            >
              <span
                class="flex size-10 shrink-0 items-center justify-center rounded-xl"
                :class="
                  item.type === 'proof' ? 'bg-accent-soft text-accent' : 'bg-brand-soft text-brand'
                "
              >
                <FileText v-if="item.type === 'proof'" :size="18" aria-hidden="true" />
                <ReceiptText v-else :size="18" aria-hidden="true" />
              </span>

              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <p class="truncate text-sm font-semibold text-ink">{{ item.title }}</p>
                  <span
                    class="shrink-0 rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted"
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
                class="shrink-0 text-stone-300 transition group-hover:translate-x-0.5 group-hover:text-brand"
              />
            </RouterLink>
          </div>
        </section>

        <section class="rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-6">
          <div>
            <h3 class="text-lg font-semibold tracking-tight text-ink">Spend by category</h3>
            <p class="mt-1 text-sm text-ink-muted">How your total is distributed.</p>
          </div>

          <div v-if="!hasCategoryBreakdown" class="py-12 text-center">
            <span
              class="mx-auto flex size-12 items-center justify-center rounded-2xl bg-accent-soft text-accent"
            >
              <Tags :size="22" :stroke-width="1.7" aria-hidden="true" />
            </span>
            <p class="mt-4 text-sm font-semibold text-ink">No category activity yet</p>
            <p class="mx-auto mt-1 max-w-xs text-sm leading-6 text-ink-muted">
              Categorized expenses will reveal where your spending is concentrated.
            </p>
          </div>

          <div v-else class="mt-7 space-y-6">
            <div
              v-for="category in summary.categoryBreakdown"
              :key="category.categoryId ?? category.categoryName"
            >
              <div class="flex items-end justify-between gap-4">
                <div class="min-w-0">
                  <p class="truncate text-sm font-semibold text-ink">{{ category.categoryName }}</p>
                  <p class="mt-0.5 text-xs text-ink-muted">
                    {{ category.expenseCount }} expense{{ category.expenseCount === 1 ? '' : 's' }}
                  </p>
                </div>
                <div class="shrink-0 text-right">
                  <p class="text-sm font-semibold text-ink">
                    ${{ formatAmount(category.totalAmount) }}
                  </p>
                  <p class="mt-0.5 text-xs text-ink-muted">
                    {{ categoryShare(category.totalAmount) }}%
                  </p>
                </div>
              </div>
              <div
                class="mt-3 h-2 overflow-hidden rounded-full bg-surface-muted"
                role="progressbar"
                :aria-label="`${category.categoryName} share of total spend`"
                :aria-valuenow="categoryShare(category.totalAmount)"
                aria-valuemin="0"
                aria-valuemax="100"
              >
                <div
                  class="h-full rounded-full bg-brand"
                  :style="{ width: `${categoryShare(category.totalAmount)}%` }"
                />
              </div>
            </div>
          </div>
        </section>
      </div>
    </template>
  </section>
</template>
