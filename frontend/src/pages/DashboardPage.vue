<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { ApiError } from '@/lib/api'
import { fetchDashboardSummary } from '@/lib/dashboard/api'
import { formatAmount, formatDate } from '@/lib/formatter'
import { dashboardSummarySchema, type DashboardSummary } from '@/lib/dashboard/schema'

const summary = ref<DashboardSummary | null>(null)
const loading = ref(true)
const error = ref('')

const hasRecentExpenses = computed(() => (summary.value?.recentExpenses.length ?? 0) > 0)
const hasCategoryBreakdown = computed(() => (summary.value?.categoryBreakdown.length ?? 0) > 0)

async function loadSummary() {
  try {
    error.value = ''
    const result = dashboardSummarySchema.safeParse(await fetchDashboardSummary())

    if (!result.success) {
      error.value = 'Failed to validate dashboard summary'
      return
    }

    summary.value = result.data
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Something went wrong'
  } finally {
    loading.value = false
  }
}

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

    <div v-if="loading" class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <div
        v-for="index in 4"
        :key="index"
        class="h-36 animate-pulse rounded-3xl border border-stone-200 bg-stone-100"
      />
    </div>

    <section
      v-else-if="error"
      class="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700"
    >
      <p class="font-medium">Could not load dashboard</p>
      <p class="mt-1">{{ error }}</p>
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
              <h3 class="text-lg font-semibold tracking-tight text-stone-900">Recent expenses</h3>
              <p class="mt-1 text-sm text-stone-500">
                The latest recorded expenses across all active vendors.
              </p>
            </div>
          </div>

          <div
            v-if="!hasRecentExpenses"
            class="mt-6 rounded-2xl border border-dashed border-stone-200 bg-stone-50 px-5 py-10 text-center"
          >
            <p class="text-sm font-medium text-stone-600">No expenses yet</p>
            <p class="mt-2 text-sm text-stone-500">
              Add expenses to start seeing recent activity here.
            </p>
          </div>

          <div v-else class="mt-6 space-y-3">
            <RouterLink
              v-for="expense in summary.recentExpenses"
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
              </div>

              <span class="shrink-0 text-sm font-semibold text-stone-900">
                ${{ formatAmount(expense.amount) }}
              </span>
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
