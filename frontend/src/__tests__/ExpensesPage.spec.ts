import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, type VueWrapper } from '@vue/test-utils'
import type { RouteRecordRaw } from 'vue-router'
import { ApiError } from '@/lib/api'
import type { ExpenseCategory } from '@/lib/expense-categories/schema'
import type { Expense, ExpensePayload } from '@/lib/expenses/schema'
import type { Vendor } from '@/lib/vendors/schema'
import ExpensesPage from '@/pages/ExpensesPage.vue'
import { mountWithRouter } from './test-mount'

const expensesApi = vi.hoisted(() => ({
  archiveExpense: vi.fn<(id: string) => Promise<Expense>>(),
  createExpense: vi.fn<(input: ExpensePayload) => Promise<Expense>>(),
  fetchExpenses:
    vi.fn<
      (filters?: {
        search?: string
        vendorId?: string
        categoryId?: string
        dateFrom?: string
        dateTo?: string
      }) => Promise<Expense[]>
    >(),
  updateExpense: vi.fn<(id: string, input: Partial<ExpensePayload>) => Promise<Expense>>(),
}))

const vendorsApi = vi.hoisted(() => ({
  fetchVendors: vi.fn<(filters?: { search?: string }) => Promise<Vendor[]>>(),
}))

const categoriesApi = vi.hoisted(() => ({
  fetchExpenseCategories: vi.fn<() => Promise<ExpenseCategory[]>>(),
}))

vi.mock('@/lib/expenses/api', () => expensesApi)
vi.mock('@/lib/vendors/api', () => vendorsApi)
vi.mock('@/lib/expense-categories/api', () => categoriesApi)

const routes: RouteRecordRaw[] = [{ path: '/expenses', name: 'expenses', component: ExpensesPage }]

const atlas: Vendor = {
  id: 'vendor-1',
  name: 'Atlas Supplies',
  email: 'hello@atlas.example',
  phone: '+212600000001',
  website: 'https://atlas.example',
  notes: 'Office supplier',
  createdAt: '2026-08-05T09:00:00.000Z',
  updatedAt: '2026-08-05T09:00:00.000Z',
  archivedAt: null,
}

const travel: ExpenseCategory = {
  id: 'category-1',
  name: 'Travel',
  color: '#2563eb',
  createdAt: '2026-08-05T09:00:00.000Z',
  updatedAt: '2026-08-05T09:00:00.000Z',
  archivedAt: null,
}

const flight: Expense = {
  id: 'expense-1',
  vendorId: atlas.id,
  categoryId: travel.id,
  description: 'Client-site flight',
  amount: '125.50',
  expenseDate: '2026-08-05T00:00:00.000Z',
  notes: 'Quarterly visit',
  createdAt: '2026-08-05T09:00:00.000Z',
  updatedAt: '2026-08-05T09:00:00.000Z',
  archivedAt: null,
}

function getButton(wrapper: VueWrapper, text: string) {
  const button = wrapper.findAll('button').find((candidate) => candidate.text() === text)
  if (!button) throw new Error(`${text} button not found`)
  return button
}

function getFilterField(wrapper: VueWrapper, label: string) {
  const searchForm = wrapper.get('form[role="search"]')
  const field = searchForm
    .findAll('label')
    .find((candidate) => candidate.find('span').text() === label)
  if (!field) throw new Error(`${label} filter not found`)
  return field.get('input, select')
}

async function mountPage(initialRoute = '/expenses') {
  const result = await mountWithRouter(ExpensesPage, routes, initialRoute)
  await flushPromises()
  return result
}

describe('expense listing and filters', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    expensesApi.fetchExpenses.mockResolvedValue([])
    vendorsApi.fetchVendors.mockResolvedValue([atlas])
    categoriesApi.fetchExpenseCategories.mockResolvedValue([travel])
  })

  it('shows loading and empty states', async () => {
    let resolveExpenses!: (expenses: Expense[]) => void
    expensesApi.fetchExpenses.mockReturnValue(
      new Promise<Expense[]>((resolve) => {
        resolveExpenses = resolve
      }),
    )

    const { wrapper } = await mountPage()

    expect(wrapper.get('[role="status"]').attributes('aria-label')).toBe('Loading expenses')

    resolveExpenses([])
    await flushPromises()

    expect(wrapper.text()).toContain('No expenses yet')
  })

  it('renders expenses with their vendor and category', async () => {
    expensesApi.fetchExpenses.mockResolvedValue([flight])

    const { wrapper } = await mountPage()

    expect(wrapper.text()).toContain('Client-site flight')
    expect(wrapper.text()).toContain('Atlas Supplies')
    expect(wrapper.text()).toContain('Travel')
    expect(wrapper.text()).toContain('Quarterly visit')
  })

  it('shows API loading failures', async () => {
    expensesApi.fetchExpenses.mockRejectedValue(new ApiError('service unavailable'))

    const { wrapper } = await mountPage()

    expect(wrapper.text()).toContain('Could not load expenses')
    expect(wrapper.text()).toContain('Service unavailable')
  })

  it('hydrates filters from a direct URL', async () => {
    const filters = {
      search: 'flight',
      vendorId: atlas.id,
      categoryId: travel.id,
      dateFrom: '2026-08-01',
      dateTo: '2026-08-31',
    }
    const query = new URLSearchParams(filters).toString()

    const { wrapper } = await mountPage(`/expenses?${query}`)

    expect(expensesApi.fetchExpenses).toHaveBeenCalledWith(filters)
    expect(getFilterField(wrapper, 'Search').element).toHaveProperty('value', 'flight')
    expect(getFilterField(wrapper, 'Vendor').element).toHaveProperty('value', atlas.id)
    expect(getFilterField(wrapper, 'Category').element).toHaveProperty('value', travel.id)
    expect(getFilterField(wrapper, 'From').element).toHaveProperty('value', '2026-08-01')
    expect(getFilterField(wrapper, 'To').element).toHaveProperty('value', '2026-08-31')
    expect(wrapper.text()).toContain('No matching expenses')
  })

  it('applies trimmed filters to the URL and reloads the list', async () => {
    const { router, wrapper } = await mountPage()

    await getFilterField(wrapper, 'Search').setValue('  client flight  ')
    await getFilterField(wrapper, 'Vendor').setValue(atlas.id)
    await getFilterField(wrapper, 'Category').setValue(travel.id)
    await getFilterField(wrapper, 'From').setValue('2026-08-01')
    await getFilterField(wrapper, 'To').setValue('2026-08-31')
    await wrapper.get('form[role="search"]').trigger('submit')
    await flushPromises()

    const filters = {
      search: 'client flight',
      vendorId: atlas.id,
      categoryId: travel.id,
      dateFrom: '2026-08-01',
      dateTo: '2026-08-31',
    }
    expect(router.currentRoute.value.query).toEqual(filters)
    expect(expensesApi.fetchExpenses).toHaveBeenLastCalledWith(filters)
  })

  it('synchronizes external route changes and clears active filters', async () => {
    const { router, wrapper } = await mountPage()

    await router.push('/expenses?search=hotel')
    await flushPromises()

    expect(getFilterField(wrapper, 'Search').element).toHaveProperty('value', 'hotel')
    expect(expensesApi.fetchExpenses).toHaveBeenLastCalledWith({
      search: 'hotel',
      vendorId: undefined,
      categoryId: undefined,
      dateFrom: undefined,
      dateTo: undefined,
    })

    await getButton(wrapper, 'Clear').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.query).toEqual({})
    expect(getFilterField(wrapper, 'Search').element).toHaveProperty('value', '')
    expect(expensesApi.fetchExpenses).toHaveBeenLastCalledWith({
      search: undefined,
      vendorId: undefined,
      categoryId: undefined,
      dateFrom: undefined,
      dateTo: undefined,
    })
  })

  it('shows inverted date-range errors from the API', async () => {
    expensesApi.fetchExpenses.mockRejectedValue(
      new ApiError('invalid filters', {
        dateRange: 'From date must be before or equal to date to',
      }),
    )

    const { wrapper } = await mountPage('/expenses?dateFrom=2026-08-31&dateTo=2026-08-01')

    expect(wrapper.text()).toContain('Could not load expenses')
    expect(wrapper.text()).toContain('From date must be before or equal to date to')
  })
})
