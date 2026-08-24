<script setup lang="ts">
import { computed } from 'vue'
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
  type ChartData,
  type ChartOptions,
} from 'chart.js'
import { Line } from 'vue-chartjs'
import type { ReportInsights } from '@/lib/reports/schema'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip)

const props = defineProps<{
  monthlyTotals: ReportInsights['monthlyTotals']
}>()

const chronologicalTotals = computed(() => [...props.monthlyTotals].reverse())

const chartData = computed<ChartData<'line'>>(() => ({
  labels: chronologicalTotals.value.map((month) => month.month),
  datasets: [
    {
      data: chronologicalTotals.value.map((month) => Number(month.totalAmount)),
      borderColor: '#a84f2a',
      backgroundColor: '#f6e7df',
      borderWidth: 2,
      fill: true,
      tension: 0.28,
      pointBackgroundColor: '#ffffff',
      pointBorderColor: '#a84f2a',
      pointBorderWidth: 2,
      pointHoverRadius: 5,
      pointRadius: 3,
    },
  ],
}))

const chartOptions: ChartOptions<'line'> = {
  responsive: true,
  maintainAspectRatio: false,
  animation: false,
  interaction: { intersect: false, mode: 'index' },
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
      border: { display: false },
      grid: { display: false },
      ticks: { color: '#667181', maxRotation: 0 },
    },
    y: {
      beginAtZero: true,
      border: { display: false },
      grid: { color: '#e9eef2' },
      ticks: {
        color: '#667181',
        maxTicksLimit: 5,
        callback: (value) => `$${value}`,
      },
    },
  },
}
</script>

<template>
  <figure data-monthly-spend-chart aria-labelledby="monthly-spend-chart-caption" class="min-w-0">
    <div class="h-48 min-w-0 sm:h-56" aria-hidden="true">
      <Line class="block !h-full !w-full" :data="chartData" :options="chartOptions" />
    </div>

    <figcaption id="monthly-spend-chart-caption" class="sr-only">
      Monthly spending is plotted chronologically.
    </figcaption>
  </figure>
</template>
