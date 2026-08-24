import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, type VueWrapper } from '@vue/test-utils'
import type { RouteRecordRaw } from 'vue-router'
import { ApiError } from '@/lib/api'
import type { CategoryComparison, ExpenseReport, ReportInsights } from '@/lib/reports/schema'
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
  fetchReportInsights:
    vi.fn<(filters?: { dateFrom?: string; dateTo?: string }) => Promise<ReportInsights>>(),
  downloadExpenseReportCsv:
    vi.fn<(filters?: { dateFrom?: string; dateTo?: string }) => Promise<Blob>>(),
  fetchCategoryComparison:
    vi.fn<(filters: { dateFrom: string; dateTo: string }) => Promise<CategoryComparison>>(),
}))

vi.mock('@/lib/reports/api', () => reportsApi)

vi.mock('vue-chartjs', () => ({
  Bar: { template: '<div data-chart-renderer="bar"></div>' },
  Doughnut: { template: '<div data-chart-renderer="doughnut"></div>' },
  Line: { template: '<div data-chart-renderer="line"></div>' },
}))

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
      pageSize: 4,
      totalItems: 3,
      totalPages: 1,
    },
  },
}

const insights: ReportInsights = {
  monthlyTotals: [
    { month: '2026-07', totalAmount: '125.50', expenseCount: 1 },
    { month: '2026-08', totalAmount: '300.00', expenseCount: 2 },
  ],
  vendorTotals: [
    {
      vendorId: 'vendor-1',
      vendorName: 'Atlas Supplies',
      totalAmount: '300.00',
      expenseCount: 2,
    },
    {
      vendorId: 'vendor-2',
      vendorName: 'Nova Services',
      totalAmount: '125.50',
      expenseCount: 1,
    },
  ],
}
const comparison: CategoryComparison = {
  currentPeriod: {
    dateFrom: '2026-08-01',
    dateTo: '2026-08-31',
    totalAmount: '425.50',
    expenseCount: 3,
  },
  previousPeriod: {
    dateFrom: '2026-07-01',
    dateTo: '2026-07-31',
    totalAmount: '225.50',
    expenseCount: 2,
  },
  categories: [
    {
      categoryId: 'category-1',
      categoryName: 'Travel',
      currentAmount: '300.00',
      previousAmount: '100.00',
      changeAmount: '200.00',
      changePercentage: 200,
    },
    {
      categoryId: 'category-2',
      categoryName: 'Meals',
      currentAmount: '125.50',
      previousAmount: '0.00',
      changeAmount: '125.50',
      changePercentage: null,
    },
  ],
}

function emptyReport(): ExpenseReport {
  return {
    totalAmount: '0.00',
    expenseCount: 0,
    categoryTotals: [],
    expenses: {
      items: [],
      pagination: {
        page: 1,
        pageSize: 4,
        totalItems: 0,
        totalPages: 0,
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

function vendorTotal(number: number): ReportInsights['vendorTotals'][number] {
  return {
    vendorId: `vendor-${number}`,
    vendorName: `Vendor ${number}`,
    totalAmount: `${800 - number * 100}.00`,
    expenseCount: 1,
  }
}

function getMetric(wrapper: VueWrapper, label: string) {
  const metric = wrapper.findAll('article').find((candidate) => candidate.text().includes(label))
  if (!metric) throw new Error(`${label} metric not found`)
  return metric
}

function getSection(wrapper: VueWrapper, label: string) {
  const section = wrapper.findAll('section').find((candidate) => {
    const heading = candidate.find('h3')
    return heading.exists() && heading.text() === label
  })
  if (!section) throw new Error(`${label} section not found`)
  return section
}

function getButton(wrapper: VueWrapper, label: string) {
  const button = wrapper.findAll('button').find((candidate) => candidate.text() === label)
  if (!button) throw new Error(`${label} button not found`)
  return button
}

async function settlePage() {
  await flushPromises()
  await vi.dynamicImportSettled()
  await flushPromises()
}

async function mountPage(initialRoute = '/reports') {
  const result = await mountWithRouter(ReportsPage, routes, initialRoute)
  await settlePage()
  return result
}

describe('report workflows', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    reportsApi.fetchExpenseReport.mockResolvedValue(report)
    reportsApi.fetchReportInsights.mockResolvedValue(insights)
    reportsApi.fetchCategoryComparison.mockResolvedValue(comparison)
  })

  it('shows loading before rendering report totals and analysis', async () => {
    let resolveReport!: (report: ExpenseReport) => void
    let resolveInsights!: (insights: ReportInsights) => void
    reportsApi.fetchExpenseReport.mockReturnValue(
      new Promise<ExpenseReport>((resolve) => {
        resolveReport = resolve
      }),
    )
    reportsApi.fetchReportInsights.mockReturnValue(
      new Promise<ReportInsights>((resolve) => {
        resolveInsights = resolve
      }),
    )

    const { wrapper } = await mountPage()

    expect(wrapper.get('[role="status"]').attributes('aria-label')).toBe('Loading expense report')

    resolveReport(report)
    resolveInsights(insights)
    await settlePage()

    expect(getMetric(wrapper, 'SPEND RECORDED').text()).toContain('$425.50')
    expect(getMetric(wrapper, 'Recorded expenses').text()).toContain('3')
    expect(getMetric(wrapper, 'Categories represented').text()).toContain('2')
    expect(wrapper.get('[aria-label="Report overview"]').findAll('article')).toHaveLength(3)
    expect(wrapper.find('[data-report-category-comparison]').exists()).toBe(false)
    expect(wrapper.get('[data-report-category-comparison-prompt]').text()).toBe(
      'Select both dates to compare category spending.',
    )
    expect(wrapper.get('[data-report-monthly-spending]').classes()).toContain('min-w-0')
    expect(wrapper.get('[data-report-vendor-spending]').classes()).toContain('min-w-0')
    expect(wrapper.text()).toContain('Travel')
    expect(wrapper.text()).toContain('Uncategorized')
    expect(wrapper.find('[data-category-totals-donut]').exists()).toBe(true)
    expect(wrapper.get('[aria-label="Category spending values"]').text()).toContain('71%')
    expect(wrapper.text()).toContain('Monthly spending')
    expect(wrapper.findAll('[data-monthly-spend-chart]')).toHaveLength(1)
    expect(wrapper.find('[data-monthly-values]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Vendor spending')
    expect(wrapper.findAll('[data-vendor-spend-chart]')).toHaveLength(1)
    expect(wrapper.get('[data-vendor-spend-chart] > div').classes()).toEqual(
      expect.arrayContaining(['hidden', 'sm:block']),
    )
    expect(wrapper.text()).toContain('Nova Services')
  })

  it('renders empty report sections', async () => {
    reportsApi.fetchExpenseReport.mockResolvedValue(emptyReport())
    reportsApi.fetchReportInsights.mockResolvedValue({ monthlyTotals: [], vendorTotals: [] })

    const { wrapper } = await mountPage()

    expect(getMetric(wrapper, 'SPEND RECORDED').text()).toContain('$0.00')
    expect(wrapper.text()).toContain('No category totals')
    expect(wrapper.text()).toContain('No monthly totals')
    expect(wrapper.text()).toContain('No vendor totals')
    expect(wrapper.text()).toContain('Select both dates to compare category spending.')
  })

  it('shows five category totals plus Other while preserving the category count', async () => {
    reportsApi.fetchExpenseReport.mockResolvedValue({
      ...report,
      categoryTotals: Array.from({ length: 7 }, (_, index) => categoryTotal(index + 1)),
    })

    const { wrapper } = await mountPage()
    const categorySection = getSection(wrapper, 'Category totals')

    expect(getMetric(wrapper, 'Categories represented').text()).toContain('7')
    expect(categorySection.text()).toContain('Category 5')
    expect(categorySection.text()).toContain('Other')
    expect(categorySection.text()).not.toContain('Category 6')
    expect(categorySection.text()).not.toContain('Category 7')
  })

  it('shows the monthly trend once and provides vendor values only on smaller screens', async () => {
    reportsApi.fetchReportInsights.mockResolvedValue({
      monthlyTotals: Array.from({ length: 7 }, (_, index) => ({
        month: `2026-0${index + 1}`,
        totalAmount: '100.00',
        expenseCount: 1,
      })),
      vendorTotals: Array.from({ length: 7 }, (_, index) => vendorTotal(index + 1)),
    })

    const { wrapper } = await mountPage()
    const monthlyChart = getSection(wrapper, 'Monthly spending').get('[data-monthly-spend-chart]')
    const vendorChart = getSection(wrapper, 'Vendor spending').get('[data-vendor-spend-chart]')
    const vendorTotals = vendorChart.get('[data-vendor-values]')

    expect(monthlyChart.get('figcaption').text()).toContain('plotted chronologically')
    expect(monthlyChart.find('[data-monthly-values]').exists()).toBe(false)
    expect(vendorChart.get('figcaption').text()).toContain('ranked from highest to lowest')
    expect(vendorTotals.classes()).toContain('sm:hidden')
    expect(vendorTotals.element.children).toHaveLength(6)
    expect(vendorTotals.text()).toContain('Vendor 5')
    expect(vendorTotals.text()).toContain('Other')
    expect(vendorTotals.text()).toContain('$300.00')
    expect(vendorTotals.text()).not.toContain('Vendor 6')
    expect(vendorTotals.text()).not.toContain('Vendor 7')
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
    expect(reportsApi.fetchReportInsights).toHaveBeenCalledWith(filters)
    expect(reportsApi.fetchCategoryComparison).toHaveBeenCalledWith(filters)
    expect(wrapper.get('fieldset legend').text()).toBe('Report date range')
    expect(wrapper.text()).toContain('Reporting period')
    expect(wrapper.text()).toContain('Custom date range')
    expect(wrapper.get('#report-date-from').element).toHaveProperty('value', filters.dateFrom)
    expect(wrapper.get('#report-date-to').element).toHaveProperty('value', filters.dateTo)
  })

  it('shows category changes for a complete date range', async () => {
    const { wrapper } = await mountPage('/reports?dateFrom=2026-08-01&dateTo=2026-08-31')
    const comparisonSection = getSection(wrapper, 'Category comparison')
    const comparisonChart = comparisonSection.get('[data-category-comparison-chart]')
    const comparisonValues = comparisonChart.get('[data-category-comparison-values]')

    expect(comparisonChart.get('figcaption').text()).toContain('selected period')
    expect(comparisonSection.text()).toContain('2026-08-01 to 2026-08-31')
    expect(comparisonSection.text()).toContain('$425.50')
    expect(comparisonSection.text()).toContain('2026-07-01 to 2026-07-31')
    expect(comparisonSection.text()).toContain('$225.50')
    expect(comparisonValues.element.children).toHaveLength(2)
    expect(comparisonValues.text()).toContain('Travel')
    expect(comparisonValues.text()).toContain('$200.00')
    expect(comparisonValues.text()).toContain('· 200%')
    expect(comparisonValues.text()).toContain('Meals')
    expect(comparisonValues.text()).toContain('$125.50')
    expect(comparisonValues.text()).toContain('· New')
  })

  it('shows an empty comparison for periods without category activity', async () => {
    reportsApi.fetchCategoryComparison.mockResolvedValue({
      ...comparison,
      categories: [],
    })

    const { wrapper } = await mountPage('/reports?dateFrom=2026-08-01&dateTo=2026-08-31')

    expect(wrapper.text()).toContain('No category activity to compare')
    expect(wrapper.find('[data-category-comparison-chart]').exists()).toBe(false)
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
    })
    expect(reportsApi.fetchReportInsights).toHaveBeenLastCalledWith(filters)
    expect(reportsApi.fetchCategoryComparison).toHaveBeenLastCalledWith(filters)
  })

  it('keeps the current report visible while a date-range refresh is loading', async () => {
    const { wrapper } = await mountPage()
    let resolveRefresh!: (value: ExpenseReport) => void
    reportsApi.fetchExpenseReport.mockReturnValue(
      new Promise<ExpenseReport>((resolve) => {
        resolveRefresh = resolve
      }),
    )

    await wrapper.get('#report-date-from').setValue('2026-08-01')
    await flushPromises()

    expect(wrapper.get('[role="status"]').text()).toBe('Updating report…')
    expect(wrapper.find('[aria-label="Report overview"]').exists()).toBe(true)

    resolveRefresh(report)
    await settlePage()
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
    expect(reportsApi.fetchReportInsights).toHaveBeenLastCalledWith({
      dateFrom: undefined,
      dateTo: undefined,
    })
    expect(reportsApi.fetchCategoryComparison).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('Select both dates to compare category spending.')
  })

  it('downloads a CSV using the active date range', async () => {
    const csv = new Blob(['Date,Description'], { type: 'text/csv' })
    reportsApi.downloadExpenseReportCsv.mockResolvedValue(csv)
    const createObjectUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:report-csv')
    const revokeObjectUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    const filters = { dateFrom: '2026-08-01', dateTo: '2026-08-31' }
    const { wrapper } = await mountPage('/reports?dateFrom=2026-08-01&dateTo=2026-08-31')

    await getButton(wrapper, 'Export CSV').trigger('click')
    await flushPromises()

    expect(reportsApi.downloadExpenseReportCsv).toHaveBeenCalledExactlyOnceWith(filters)
    expect(createObjectUrl).toHaveBeenCalledExactlyOnceWith(csv)
    expect(click).toHaveBeenCalledOnce()
    expect(revokeObjectUrl).toHaveBeenCalledExactlyOnceWith('blob:report-csv')
  })

  it('keeps the report visible when CSV export fails', async () => {
    reportsApi.downloadExpenseReportCsv.mockRejectedValue(new ApiError('export unavailable'))
    const { wrapper } = await mountPage()

    await getButton(wrapper, 'Export CSV').trigger('click')
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toBe('Export unavailable')
    expect(getMetric(wrapper, 'SPEND RECORDED').text()).toContain('$425.50')
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
