import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, type VueWrapper } from '@vue/test-utils'
import type { RouteRecordRaw } from 'vue-router'
import { ApiError } from '@/lib/api'
import type { ExpenseReport } from '@/lib/reports/schema'
import ReportsPage from '@/pages/ReportsPage.vue'
import { mountWithRouter } from './test-mount'

const reportsApi = vi.hoisted(() => ({
  fetchExpenseReport:
    vi.fn<
      (filters?: {
        dateFrom?: string
        dateTo?: string
        page?: number
        pageSize?: number
      }) => Promise<ExpenseReport>
    >(),
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
  expenses: {
    items: [
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
    pagination: {
      page: 1,
      pageSize: 6,
      totalItems: 3,
      totalPages: 1,
    },
  },
}

const firstPageQuery = { page: 1, pageSize: 6 }

function emptyReport(): ExpenseReport {
  return {
    totalAmount: '0.00',
    expenseCount: 0,
    categoryTotals: [],
    expenses: {
      items: [],
      pagination: {
        page: 1,
        pageSize: 6,
        totalItems: 0,
        totalPages: 0,
      },
    },
  }
}

function paginatedReport(page: number, totalItems = 25, totalPages = 5): ExpenseReport {
  return {
    ...report,
    expenseCount: totalItems,
    expenses: {
      items: report.expenses.items,
      pagination: {
        page,
        pageSize: 6,
        totalItems,
        totalPages,
      },
    },
  }
}

function categoryTotal(number: number): ExpenseReport['categoryTotals'][number] {
  return {
    categoryId: `category-${number}`,
    categoryName: `Category ${number}`,
    totalAmount: `${800 - number * 100}.00`,
    expenseCount: 1,
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

  it('shows five category totals plus Other while preserving the category count', async () => {
    reportsApi.fetchExpenseReport.mockResolvedValue({
      ...report,
      categoryTotals: Array.from({ length: 7 }, (_, index) => categoryTotal(index + 1)),
    })

    const { wrapper } = await mountPage()
    const categorySection = wrapper
      .findAll('section')
      .find((section) => section.find('h3').text() === 'Category totals')
    if (!categorySection) throw new Error('Category totals section not found')

    expect(getMetric(wrapper, 'Categories').text()).toContain('7')
    expect(categorySection.text()).toContain('Category 5')
    expect(categorySection.text()).toContain('Other')
    expect(categorySection.text()).not.toContain('Category 6')
    expect(categorySection.text()).not.toContain('Category 7')
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

    expect(reportsApi.fetchExpenseReport).toHaveBeenCalledWith({ ...filters, ...firstPageQuery })
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
    expect(reportsApi.fetchExpenseReport).toHaveBeenLastCalledWith({
      ...filters,
      ...firstPageQuery,
    })
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
      ...firstPageQuery,
    })
  })

  it('loads report pages from the URL and navigates between them', async () => {
    reportsApi.fetchExpenseReport.mockResolvedValue(paginatedReport(2))

    const { router, wrapper } = await mountPage('/reports?page=2')

    expect(reportsApi.fetchExpenseReport).toHaveBeenCalledWith({
      dateFrom: undefined,
      dateTo: undefined,
      page: 2,
      pageSize: 6,
    })
    expect(wrapper.get('nav[aria-label="Report expense pagination"]').text()).toContain(
      'Page 2 of 5 · 25 expenses',
    )

    const nextButton = wrapper.findAll('button').find((button) => button.text() === 'Next')
    if (!nextButton) throw new Error('Next page button not found')

    await nextButton.trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.query).toEqual({ page: '3' })
    expect(reportsApi.fetchExpenseReport).toHaveBeenLastCalledWith({
      dateFrom: undefined,
      dateTo: undefined,
      page: 3,
      pageSize: 6,
    })
  })

  it('redirects an out-of-range page to the final report page', async () => {
    reportsApi.fetchExpenseReport
      .mockResolvedValueOnce(paginatedReport(5, 12, 2))
      .mockResolvedValueOnce(paginatedReport(2, 12, 2))

    const { router } = await mountPage('/reports?page=5')
    await flushPromises()

    expect(router.currentRoute.value.query).toEqual({ page: '2' })
    expect(reportsApi.fetchExpenseReport).toHaveBeenLastCalledWith({
      dateFrom: undefined,
      dateTo: undefined,
      page: 2,
      pageSize: 6,
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
