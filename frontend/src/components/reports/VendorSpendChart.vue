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
import type { ReportInsights } from '@/lib/reports/schema'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip)

const props = defineProps<{
  vendorTotals: ReportInsights['vendorTotals']
}>()

const chartData = computed<ChartData<'bar'>>(() => ({
  labels: props.vendorTotals.map((vendor) => vendor.vendorName),
  datasets: [
    {
      data: props.vendorTotals.map((vendor) => Number(vendor.totalAmount)),
      backgroundColor: '#32435f',
      hoverBackgroundColor: '#a84f2a',
      borderRadius: 6,
      borderSkipped: false,
      barThickness: 18,
    },
  ],
}))

const chartOptions: ChartOptions<'bar'> = {
  responsive: true,
  maintainAspectRatio: false,
  animation: false,
  indexAxis: 'y',
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
        maxTicksLimit: 5,
        callback: (value) => `$${value}`,
      },
    },
    y: {
      border: { display: false },
      grid: { display: false },
      ticks: { color: '#32435f' },
    },
  },
}
</script>

<template>
  <figure data-vendor-spend-chart aria-labelledby="vendor-spend-chart-caption" class="min-w-0">
    <div class="hidden h-60 min-w-0 sm:block" aria-hidden="true">
      <Bar class="block !h-full !w-full" :data="chartData" :options="chartOptions" />
    </div>

    <figcaption id="vendor-spend-chart-caption" class="sr-only">
      Vendor spending is ranked from highest to lowest and listed with exact values below the chart.
    </figcaption>

    <ol
      data-vendor-values
      class="mt-0 divide-y divide-line sm:mt-5"
      aria-label="Vendor spending values"
    >
      <li
        v-for="vendor in vendorTotals"
        :key="vendor.vendorId"
        class="flex min-w-0 items-start justify-between gap-4 px-1 py-4 first:pt-0 last:pb-0"
      >
        <div class="min-w-0">
          <p class="truncate text-sm font-semibold text-ink">{{ vendor.vendorName }}</p>
          <p class="mt-1 text-xs text-ink-muted">
            {{ vendor.expenseCount }} expense{{ vendor.expenseCount === 1 ? '' : 's' }}
          </p>
        </div>
        <span class="font-figure shrink-0 text-sm font-semibold text-ink">
          ${{ formatAmount(vendor.totalAmount) }}
        </span>
      </li>
    </ol>
  </figure>
</template>
