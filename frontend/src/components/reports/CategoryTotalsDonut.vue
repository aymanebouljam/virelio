<script setup lang="ts">
import { computed } from 'vue'
import {
  ArcElement,
  Chart as ChartJS,
  DoughnutController,
  Tooltip,
  type ChartData,
  type ChartOptions,
} from 'chart.js'
import { Doughnut } from 'vue-chartjs'
import { formatAmount } from '@/lib/helpers'
import type { ExpenseReport } from '@/lib/reports/schema'

ChartJS.register(DoughnutController, ArcElement, Tooltip)

const props = defineProps<{
  categoryTotals: ExpenseReport['categoryTotals']
}>()

const segmentColors = ['#a84f2a', '#33466a', '#70819a', '#b8c2ce', '#d6dde5', '#e9eef2']

const totalAmount = computed(() =>
  props.categoryTotals.reduce((total, category) => total + Number(category.totalAmount), 0),
)

const chartData = computed<ChartData<'doughnut'>>(() => ({
  labels: props.categoryTotals.map((category) => category.categoryName),
  datasets: [
    {
      data: props.categoryTotals.map((category) => Number(category.totalAmount)),
      backgroundColor: props.categoryTotals.map((_, index) => segmentColors[index] ?? '#e9eef2'),
      borderColor: '#ffffff',
      borderWidth: 3,
      borderRadius: 2,
      spacing: 1,
    },
  ],
}))

const chartOptions: ChartOptions<'doughnut'> = {
  responsive: true,
  maintainAspectRatio: false,
  animation: false,
  cutout: '70%',
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
}

function categoryShare(amount: string) {
  if (totalAmount.value <= 0) return 0

  return Math.round((Number(amount) / totalAmount.value) * 100)
}
</script>

<template>
  <figure
    data-category-totals-donut
    aria-labelledby="category-totals-donut-caption"
    class="min-w-0"
  >
    <div class="grid items-center gap-6 sm:grid-cols-[11rem_minmax(0,1fr)]">
      <div class="relative mx-auto size-44" aria-hidden="true">
        <Doughnut class="block !h-full !w-full" :data="chartData" :options="chartOptions" />
        <div
          class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center"
        >
          <span class="text-[10px] font-semibold tracking-[0.12em] text-ink-muted">RECORDED</span>
          <span class="font-figure mt-1 text-lg font-semibold tracking-[-0.03em] text-ink">
            ${{ formatAmount(totalAmount.toFixed(2)) }}
          </span>
        </div>
      </div>

      <ol class="divide-y divide-line border-y border-line" aria-label="Category spending values">
        <li
          v-for="(category, index) in categoryTotals"
          :key="category.categoryId ?? category.categoryName"
          class="grid grid-cols-[minmax(0,1fr)_auto] gap-4 py-3 first:pt-3 last:pb-3"
        >
          <div class="flex min-w-0 items-start gap-2.5">
            <span
              class="mt-1.5 size-2.5 shrink-0 rounded-full"
              :style="{ backgroundColor: segmentColors[index] ?? '#e9eef2' }"
              aria-hidden="true"
            />
            <div class="min-w-0">
              <p class="truncate text-sm font-semibold text-ink">{{ category.categoryName }}</p>
              <p class="mt-0.5 text-xs text-ink-muted">
                {{ category.expenseCount }} expense{{ category.expenseCount === 1 ? '' : 's' }} ·
                {{ categoryShare(category.totalAmount) }}%
              </p>
            </div>
          </div>
          <span class="font-figure shrink-0 text-sm font-semibold text-ink">
            ${{ formatAmount(category.totalAmount) }}
          </span>
        </li>
      </ol>
    </div>

    <figcaption id="category-totals-donut-caption" class="sr-only">
      Category spending is shown as portions of the total, with exact values and percentages listed.
    </figcaption>
  </figure>
</template>
