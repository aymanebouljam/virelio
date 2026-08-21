import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import type { RouteRecordRaw } from 'vue-router'
import { ApiError } from '@/lib/api'
import type { DashboardSummary } from '@/lib/dashboard/schema'
import DashboardPage from '@/pages/DashboardPage.vue'
import { mountWithRouter } from './test-mount'

const dashboardApi = vi.hoisted(() => ({
  fetchDashboardSummary:
    vi.fn<(filters?: { dateFrom?: string; dateTo?: string }) => Promise<DashboardSummary>>(),
}))

vi.mock('@/lib/dashboard/api', () => dashboardApi)

const routes: RouteRecordRaw[] = [
  { path: '/', name: 'dashboard', component: DashboardPage },
  {
    path: '/expenses',
    name: 'expenses',
    component: { template: '<p>Expenses</p>' },
  },
  {
    path: '/expenses/:id',
    name: 'expenseDetails',
    component: { template: '<p>Expense details</p>' },
  },
  {
    path: '/vendors',
    name: 'vendors',
    component: { template: '<p>Vendors</p>' },
  },
]

const summary: DashboardSummary = {
  totalSpend: '425.50',
  activeVendors: 3,
  uncategorizedExpenses: 1,
  proofDocuments: 2,
  recentExpenses: [],
  recentProofs: [],
  recentActivity: [
    {
      id: 'expense-1',
      type: 'expense',
      title: 'Client-site flight',
      subtitle: 'Atlas Supplies',
      occurredAt: '2026-08-05T09:00:00.000Z',
      expenseId: 'expense-1',
    },
    {
      id: 'proof-1',
      type: 'proof',
      title: 'receipt.pdf',
      subtitle: 'Client-site flight',
      occurredAt: '2026-08-05T10:00:00.000Z',
      expenseId: 'expense-1',
    },
  ],
  categoryBreakdown: [
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
}

function emptySummary(): DashboardSummary {
  return {
    totalSpend: '0.00',
    activeVendors: 0,
    uncategorizedExpenses: 0,
    proofDocuments: 0,
    recentExpenses: [],
    recentProofs: [],
    recentActivity: [],
    categoryBreakdown: [],
  }
}

async function mountPage(initialRoute = '/') {
  const result = await mountWithRouter(DashboardPage, routes, initialRoute)
  await flushPromises()
  return result
}

describe('dashboard workflows', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    dashboardApi.fetchDashboardSummary.mockResolvedValue(summary)
  })

  it('shows loading before rendering metrics, category breakdown, and recent activity', async () => {
    let resolveSummary!: (summary: DashboardSummary) => void
    dashboardApi.fetchDashboardSummary.mockReturnValue(
      new Promise<DashboardSummary>((resolve) => {
        resolveSummary = resolve
      }),
    )

    const { wrapper } = await mountPage()

    expect(wrapper.get('[role="status"]').attributes('aria-label')).toBe('Loading dashboard')

    resolveSummary(summary)
    await flushPromises()

    expect(wrapper.get('h1').text()).toBe('Follow the record, not the noise.')
    expect(wrapper.findAll('[data-summary-metric]')).toHaveLength(4)
    expect(wrapper.text()).toContain('$425.50')
    expect(wrapper.text()).toContain('Active vendors 3')
    expect(wrapper.text()).toContain('Uncategorized 1')
    expect(wrapper.text()).toContain('Proof documents 2')
    expect(wrapper.text()).toContain('Travel')
    expect(wrapper.text()).toContain('2 expenses')
    expect(wrapper.text()).toContain('Client-site flight')
    expect(wrapper.text()).toContain('receipt.pdf')
    expect(wrapper.findAll('a[href="/expenses/expense-1"]')).toHaveLength(2)
    expect(
      wrapper.get('[aria-label="Travel share of total spend"]').attributes('aria-valuenow'),
    ).toBe('71')
  })

  it('renders empty dashboard sections', async () => {
    dashboardApi.fetchDashboardSummary.mockResolvedValue(emptySummary())

    const { wrapper } = await mountPage()

    expect(wrapper.text()).toContain('$0.00')
    expect(wrapper.text()).toContain('No activity yet')
    expect(wrapper.text()).toContain('No category activity yet')
    expect(wrapper.get('a[href="/expenses"]').text()).toContain('Manage expenses')
  })

  it('renders the combined remaining category activity as Other', async () => {
    dashboardApi.fetchDashboardSummary.mockResolvedValue({
      ...emptySummary(),
      categoryBreakdown: [
        {
          categoryId: null,
          categoryName: 'Other',
          totalAmount: '300.00',
          expenseCount: 2,
        },
      ],
    })

    const { wrapper } = await mountPage()
    const categorySection = wrapper
      .findAll('section')
      .find((section) => section.text().includes('Spend by category'))

    expect(categorySection?.text()).toContain('Other')
    expect(categorySection?.text()).toContain('2 expenses')
    expect(categorySection?.text()).toContain('$300.00')
    expect(categorySection?.get('[role="progressbar"]').attributes('aria-valuenow')).toBe('0')
  })

  it('shows API loading failures', async () => {
    dashboardApi.fetchDashboardSummary.mockRejectedValue(new ApiError('service unavailable'))

    const { wrapper } = await mountPage()

    expect(wrapper.get('[role="alert"]').text()).toContain('Could not load dashboard')
    expect(wrapper.get('[role="alert"]').text()).toContain('Service unavailable')
  })

  it('hydrates a direct date range from the URL', async () => {
    const filters = { dateFrom: '2026-08-01', dateTo: '2026-08-31' }

    const { wrapper } = await mountPage('/?dateFrom=2026-08-01&dateTo=2026-08-31')

    expect(dashboardApi.fetchDashboardSummary).toHaveBeenCalledWith(filters)
    expect(wrapper.get('fieldset legend').text()).toBe('Dashboard date range')
    expect(wrapper.get('#dashboard-date-from').element).toHaveProperty('value', filters.dateFrom)
    expect(wrapper.get('#dashboard-date-to').element).toHaveProperty('value', filters.dateTo)
  })

  it('updates the URL and reloads when the date range changes', async () => {
    const { router, wrapper } = await mountPage()

    await wrapper.get('#dashboard-date-from').setValue('2026-08-01')
    await flushPromises()
    await wrapper.get('#dashboard-date-to').setValue('2026-08-31')
    await flushPromises()

    const filters = { dateFrom: '2026-08-01', dateTo: '2026-08-31' }
    expect(router.currentRoute.value.query).toEqual(filters)
    expect(dashboardApi.fetchDashboardSummary).toHaveBeenLastCalledWith(filters)
  })

  it('clears the active date range', async () => {
    const { router, wrapper } = await mountPage('/?dateFrom=2026-08-01&dateTo=2026-08-31')

    await wrapper.get('button').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.query).toEqual({})
    expect(wrapper.get('#dashboard-date-from').element).toHaveProperty('value', '')
    expect(wrapper.get('#dashboard-date-to').element).toHaveProperty('value', '')
    expect(dashboardApi.fetchDashboardSummary).toHaveBeenLastCalledWith({
      dateFrom: undefined,
      dateTo: undefined,
    })
  })

  it('shows inverted date-range errors from the API', async () => {
    dashboardApi.fetchDashboardSummary.mockRejectedValue(
      new ApiError('invalid filters', {
        dateRange: 'From date must be before or equal to date to',
      }),
    )

    const { wrapper } = await mountPage('/?dateFrom=2026-08-31&dateTo=2026-08-01')

    expect(wrapper.get('[role="alert"]').text()).toContain('Could not load dashboard')
    expect(wrapper.get('#dashboard-date-range-error').text()).toBe(
      'From date must be before or equal to date to',
    )
    expect(wrapper.get('#dashboard-date-from').attributes()).toMatchObject({
      'aria-describedby': 'dashboard-date-range-error',
      'aria-invalid': 'true',
    })
    expect(wrapper.get('#dashboard-date-to').attributes()).toMatchObject({
      'aria-describedby': 'dashboard-date-range-error',
      'aria-invalid': 'true',
    })
  })
})
