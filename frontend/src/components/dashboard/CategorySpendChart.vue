<script setup lang="ts">
import { computed } from 'vue'
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  LinearScale,
  Tooltip,
  type ChartData,
  type ChartOptions,
} from 'chart.js'
import { Bar } from 'vue-chartjs'
import type { DashboardSummary } from '@/lib/dashboard/schema'
import { formatAmount } from '@/lib/helpers'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip)

const props = defineProps<{
  categories: DashboardSummary['categoryBreakdown']
  totalSpend: string
}>()

const chartData = computed<ChartData<'bar'>>(() => ({
  labels: props.categories.map((category) => category.categoryName),
  datasets: [
    {
      data: props.categories.map((category) => Number(category.totalAmount)),
      backgroundColor: props.categories.map((_, index) => (index === 0 ? '#a84f2a' : '#33466a')),
      borderRadius: 3,
      borderSkipped: false,
      barThickness: 14,
    },
  ],
}))

const chartOptions: ChartOptions<'bar'> = {
  indexAxis: 'y',
  responsive: true,
  maintainAspectRatio: false,
  animation: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      displayColors: false,
      backgroundColor: '#1f2b42',
      padding: 10,
      callbacks: {
        label: (context) => `$${Number(context.raw).toFixed(2)}`,
      },
    },
  },
  scales: {
    x: {
      beginAtZero: true,
      border: { display: false },
      grid: { color: '#e9eef2' },
      ticks: {
        color: '#667181',
        maxTicksLimit: 4,
        callback: (value) => `$${value}`,
      },
    },
    y: {
      border: { display: false },
      grid: { display: false },
      ticks: { color: '#202733' },
    },
  },
}

function categoryShare(totalAmount: string) {
  const total = Number(props.totalSpend)
  if (total <= 0) return 0

  return Math.min(100, Math.round((Number(totalAmount) / total) * 100))
}
</script>

<template>
  <figure aria-labelledby="category-spend-chart-title" class="min-w-0">
    <div class="h-48 min-w-0 sm:h-52" aria-hidden="true">
      <Bar class="block !h-full !w-full" :data="chartData" :options="chartOptions" />
    </div>

    <figcaption id="category-spend-chart-title" class="sr-only">
      Category totals are listed below the chart.
    </figcaption>

    <ol
      class="mt-5 divide-y divide-line border-t border-line"
      aria-label="Category spending values"
    >
      <li
        v-for="(category, index) in categories"
        :key="category.categoryId ?? category.categoryName"
        :data-category-value="category.categoryName"
        class="grid grid-cols-[minmax(0,1fr)_auto] gap-4 py-3"
      >
        <div class="flex min-w-0 items-start gap-3">
          <span
            class="mt-1.5 h-3 w-1 shrink-0 rounded-sm"
            :class="index === 0 ? 'bg-accent' : 'bg-brand'"
            aria-hidden="true"
          />
          <div class="min-w-0">
            <p class="truncate text-sm font-semibold text-ink">{{ category.categoryName }}</p>
            <p class="mt-0.5 text-xs text-ink-muted">
              {{ category.expenseCount }} expense{{ category.expenseCount === 1 ? '' : 's' }}
            </p>
          </div>
        </div>
        <div class="text-right">
          <p class="font-figure text-sm font-semibold text-ink">
            ${{ formatAmount(category.totalAmount) }}
          </p>
          <p class="mt-0.5 text-xs text-ink-muted">{{ categoryShare(category.totalAmount) }}%</p>
        </div>
      </li>
    </ol>
  </figure>
</template>
