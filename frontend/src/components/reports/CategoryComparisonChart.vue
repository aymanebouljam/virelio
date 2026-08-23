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
import { formatAmount } from '@/lib/helpers'
import type { CategoryComparison } from '@/lib/reports/schema'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip)

const props = defineProps<{
  comparison: CategoryComparison
}>()

const chartData = computed<ChartData<'bar'>>(() => ({
  labels: props.comparison.categories.map((category) => category.categoryName),
  datasets: [
    {
      label: 'Selected period',
      data: props.comparison.categories.map((category) => Number(category.currentAmount)),
      backgroundColor: '#a84f2a',
      borderRadius: 5,
      borderSkipped: false,
    },
    {
      label: 'Previous period',
      data: props.comparison.categories.map((category) => Number(category.previousAmount)),
      backgroundColor: '#b8c2ce',
      borderRadius: 5,
      borderSkipped: false,
    },
  ],
}))

const chartOptions: ChartOptions<'bar'> = {
  responsive: true,
  maintainAspectRatio: false,
  animation: false,
  indexAxis: 'y',
  interaction: { intersect: false, mode: 'index' },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#1f2b42',
      padding: 10,
      callbacks: {
        label: (context) =>
          `${context.dataset.label ?? 'Amount'}: $${Number(context.raw).toFixed(2)}`,
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
        maxTicksLimit: 6,
        callback: (value) => `$${value}`,
      },
    },
    y: {
      border: { display: false },
      grid: { display: false },
      ticks: { color: '#33466a' },
    },
  },
}
</script>

<template>
  <figure data-category-comparison-chart aria-labelledby="category-comparison-chart-caption">
    <div
      class="flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-ink-muted"
      aria-hidden="true"
    >
      <span class="inline-flex items-center gap-2">
        <span class="size-2.5 rounded-sm bg-accent" />
        Selected period
      </span>
      <span class="inline-flex items-center gap-2">
        <span class="size-2.5 rounded-sm bg-line-strong" />
        Previous period
      </span>
    </div>

    <div class="mt-4 h-72" aria-hidden="true">
      <Bar :data="chartData" :options="chartOptions" />
    </div>

    <figcaption id="category-comparison-chart-caption" class="sr-only">
      Category spending compares the selected period with the previous period and is listed with
      exact values below the chart.
    </figcaption>

    <ol
      data-category-comparison-values
      class="mt-5 max-h-[32rem] divide-y divide-line overflow-y-auto pr-1"
      aria-label="Category comparison values"
    >
      <li
        v-for="category in comparison.categories"
        :key="category.categoryId ?? category.categoryName"
        class="grid gap-3 px-1 py-4 first:pt-0 last:pb-0 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center"
      >
        <p class="text-sm font-semibold text-ink">{{ category.categoryName }}</p>
        <p class="text-xs text-ink-muted">
          Current
          <span class="font-semibold text-ink"> ${{ formatAmount(category.currentAmount) }} </span>
        </p>
        <p class="text-xs text-ink-muted">
          Previous
          <span class="font-semibold text-ink"> ${{ formatAmount(category.previousAmount) }} </span>
        </p>
        <p class="text-xs text-ink-muted">
          Change
          <span class="font-semibold text-ink">
            ${{ formatAmount(category.changeAmount) }}
            <template v-if="category.changePercentage === null"> · New</template>
            <template v-else> · {{ category.changePercentage }}%</template>
          </span>
        </p>
      </li>
    </ol>
  </figure>
</template>
