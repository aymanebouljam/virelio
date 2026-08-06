import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, type VueWrapper } from '@vue/test-utils'
import type { RouteRecordRaw } from 'vue-router'
import { ApiError } from '@/lib/api'
import type { ExpenseReport } from '@/lib/reports/schema'
import ReportsPage from '@/pages/ReportsPage.vue'
import { mountWithRouter } from './test-mount'

const reportsApi = vi.hoisted(() => ({
  fetchExpenseReport:
    vi.fn<(filters?: { dateFrom?: string; dateTo?: string }) => Promise<ExpenseReport>>(),
}))

vi.mock('@/lib/reports/api', () => reportsApi)

const routes: RouteRecordRaw[] = [
  { path: '/reports', name: 'reports', component: ReportsPage },
  {
    path: '/expenses/:id',
    name: 'expenseDetails',
    component: { template: '<p>Expense details</p>' },
  },
]

const report: ExpenseReport = {
  totalAmount: '425.50',
  expenseCount: 3,
  categoryTotals: [
    {
      categoryId: 'category-1',
      categoryName: 'Travel',
      totalAmount: '300.00',
      expenseCount: 2,
    },
    {
      categoryId: null,
      categoryName: 'Uncategorized',
      totalAmount: '125.50',
      expenseCount: 1,
    },
  ],
  expenses: [
    {
      id: 'expense-1',
      description: 'Client-site flight',
      amount: '300.00',
      expenseDate: '2026-08-05T00:00:00.000Z',
      vendorId: 'vendor-1',
      vendorName: 'Atlas Supplies',
      categoryId: 'category-1',
      categoryName: 'Travel',
      notes: 'Quarterly visit',
    },
    {
      id: 'expense-2',
      description: 'Office supplies',
      amount: '125.50',
      expenseDate: '2026-08-04T00:00:00.000Z',
      vendorId: 'vendor-2',
      vendorName: 'Nova Services',
      categoryId: null,
      categoryName: 'Uncategorized',
      notes: null,
    },
  ],
}

function emptyReport(): ExpenseReport {
  return {
    totalAmount: '0.00',
    expenseCount: 0,
    categoryTotals: [],
    expenses: [],
  }
}

function getMetric(wrapper: VueWrapper, label: string) {
  const metric = wrapper.findAll('article').find((candidate) => candidate.text().includes(label))
  if (!metric) throw new Error(`${label} metric not found`)
  return metric
}

async function mountPage(initialRoute = '/reports') {
  const result = await mountWithRouter(ReportsPage, routes, initialRoute)
  await flushPromises()
  return result
}

describe('report workflows', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    reportsApi.fetchExpenseReport.mockResolvedValue(report)
  })

  it('shows loading before rendering totals, category groups, and expense rows', async () => {
    let resolveReport!: (report: ExpenseReport) => void
    reportsApi.fetchExpenseReport.mockReturnValue(
      new Promise<ExpenseReport>((resolve) => {
        resolveReport = resolve
      }),
    )

    const { wrapper } = await mountPage()

    expect(wrapper.get('[role="status"]').attributes('aria-label')).toBe('Loading expense report')

    resolveReport(report)
    await flushPromises()

    expect(getMetric(wrapper, 'Total amount').text()).toContain('$425.50')
    expect(getMetric(wrapper, 'Expense count').text()).toContain('3')
    expect(getMetric(wrapper, 'Categories').text()).toContain('2')
    expect(wrapper.text()).toContain('Travel')
    expect(wrapper.text()).toContain('Uncategorized')
    expect(wrapper.text()).toContain('Client-site flight')
    expect(wrapper.text()).toContain('Atlas Supplies')
    expect(wrapper.text()).toContain('Office supplies')
    expect(wrapper.find('a[href="/expenses/expense-1"]').exists()).toBe(true)
    expect(wrapper.find('a[href="/expenses/expense-2"]').exists()).toBe(true)
  })

  it('renders empty report sections', async () => {
    reportsApi.fetchExpenseReport.mockResolvedValue(emptyReport())

    const { wrapper } = await mountPage()

    expect(getMetric(wrapper, 'Total amount').text()).toContain('$0.00')
    expect(wrapper.text()).toContain('No category totals')
    expect(wrapper.text()).toContain('No matching expenses')
  })

  it('shows API loading failures', async () => {
    reportsApi.fetchExpenseReport.mockRejectedValue(new ApiError('service unavailable'))

    const { wrapper } = await mountPage()

    expect(wrapper.get('[role="alert"]').text()).toContain('Could not load expense report')
    expect(wrapper.get('[role="alert"]').text()).toContain('Service unavailable')
  })

  it('hydrates a direct date range from the URL', async () => {
    const filters = { dateFrom: '2026-08-01', dateTo: '2026-08-31' }

    const { wrapper } = await mountPage('/reports?dateFrom=2026-08-01&dateTo=2026-08-31')

    expect(reportsApi.fetchExpenseReport).toHaveBeenCalledWith(filters)
    expect(wrapper.get('fieldset legend').text()).toBe('Report date range')
    expect(wrapper.get('#report-date-from').element).toHaveProperty('value', filters.dateFrom)
    expect(wrapper.get('#report-date-to').element).toHaveProperty('value', filters.dateTo)
  })

  it('updates the URL and reloads when the date range changes', async () => {
    const { router, wrapper } = await mountPage()

    await wrapper.get('#report-date-from').setValue('2026-08-01')
    await flushPromises()
    await wrapper.get('#report-date-to').setValue('2026-08-31')
    await flushPromises()

    const filters = { dateFrom: '2026-08-01', dateTo: '2026-08-31' }
    expect(router.currentRoute.value.query).toEqual(filters)
    expect(reportsApi.fetchExpenseReport).toHaveBeenLastCalledWith(filters)
  })

  it('clears the active date range', async () => {
    const { router, wrapper } = await mountPage('/reports?dateFrom=2026-08-01&dateTo=2026-08-31')

    await wrapper.get('button').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.query).toEqual({})
    expect(wrapper.get('#report-date-from').element).toHaveProperty('value', '')
    expect(wrapper.get('#report-date-to').element).toHaveProperty('value', '')
    expect(reportsApi.fetchExpenseReport).toHaveBeenLastCalledWith({
      dateFrom: undefined,
      dateTo: undefined,
    })
  })

  it('shows inverted date-range errors from the API', async () => {
    reportsApi.fetchExpenseReport.mockRejectedValue(
      new ApiError('invalid filters', {
        dateRange: 'From date must be before or equal to date to',
      }),
    )

    const { wrapper } = await mountPage('/reports?dateFrom=2026-08-31&dateTo=2026-08-01')

    expect(wrapper.get('[role="alert"]').text()).toContain('Could not load expense report')
    expect(wrapper.get('#report-date-range-error').text()).toBe(
      'From date must be before or equal to date to',
    )
    expect(wrapper.get('#report-date-from').attributes()).toMatchObject({
      'aria-describedby': 'report-date-range-error',
      'aria-invalid': 'true',
    })
    expect(wrapper.get('#report-date-to').attributes()).toMatchObject({
      'aria-describedby': 'report-date-range-error',
      'aria-invalid': 'true',
    })
  })
})
