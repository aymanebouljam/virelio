import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, type VueWrapper } from '@vue/test-utils'
import type { RouteRecordRaw } from 'vue-router'
import { ApiError, type PaginatedResponse } from '@/lib/api'
import type { ExpenseCategory } from '@/lib/expense-categories/schema'
import type { ExpenseFilters } from '@/lib/expenses/api'
import type { Expense, ExpensePayload } from '@/lib/expenses/schema'
import type { Vendor } from '@/lib/vendors/schema'
import ExpensesPage from '@/pages/ExpensesPage.vue'
import { mountWithRouter } from './test-mount'

const expensesApi = vi.hoisted(() => ({
  archiveExpense: vi.fn<(id: string) => Promise<Expense>>(),
  createExpense: vi.fn<(input: ExpensePayload) => Promise<Expense>>(),
  fetchExpenses: vi.fn<(filters?: ExpenseFilters) => Promise<PaginatedResponse<Expense>>>(),
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

function expense(overrides: Partial<Expense>): Expense {
  return { ...flight, ...overrides }
}

function expensePage(
  items: Expense[],
  pagination: Partial<PaginatedResponse<Expense>['pagination']> = {},
): PaginatedResponse<Expense> {
  return {
    items,
    pagination: {
      page: 1,
      pageSize: 6,
      totalItems: items.length,
      totalPages: items.length > 0 ? 1 : 0,
      ...pagination,
    },
  }
}

function expenseRequest(filters: ExpenseFilters = {}): ExpenseFilters {
  return {
    search: undefined,
    vendorId: undefined,
    categoryId: undefined,
    proofStatus: undefined,
    categoryStatus: undefined,
    dateFrom: undefined,
    dateTo: undefined,
    page: 1,
    pageSize: 6,
    ...filters,
  }
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

function getExpenseForm(wrapper: VueWrapper) {
  return wrapper.get('form[aria-label="Expense form"]')
}

function getExpenseField(wrapper: VueWrapper, label: string) {
  const field = getExpenseForm(wrapper)
    .findAll('label')
    .find((candidate) => candidate.find('span').text() === label)
  if (!field) throw new Error(`${label} expense field not found`)
  return field.get('input, select, textarea')
}

function expectInvalidField(wrapper: VueWrapper, selector: string, errorId: string) {
  expect(wrapper.get(selector).attributes()).toMatchObject({
    'aria-describedby': errorId,
    'aria-invalid': 'true',
  })
  expect(wrapper.get(`#${errorId}`).text()).not.toBe('')
}

async function mountPage(initialRoute = '/expenses') {
  const result = await mountWithRouter(ExpensesPage, routes, initialRoute)
  await flushPromises()
  return result
}

function stubMobileViewport(matches = true) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches,
      addEventListener: vi.fn<() => void>(),
      removeEventListener: vi.fn<() => void>(),
    })),
  )
}

describe('expense listing and filters', () => {
  it('links to archived expenses from the active ledger', async () => {
    const { wrapper } = await mountPage()

    expect(wrapper.get('a[href="/expenses/archived"]').text()).toContain('Archived expenses')
  })

  beforeEach(() => {
    vi.resetAllMocks()
    expensesApi.fetchExpenses.mockResolvedValue(expensePage([]))
    vendorsApi.fetchVendors.mockResolvedValue([atlas])
    categoriesApi.fetchExpenseCategories.mockResolvedValue([travel])
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows loading and empty states', async () => {
    let resolveExpenses!: (page: PaginatedResponse<Expense>) => void
    expensesApi.fetchExpenses.mockReturnValue(
      new Promise<PaginatedResponse<Expense>>((resolve) => {
        resolveExpenses = resolve
      }),
    )

    const { wrapper } = await mountPage()

    expect(wrapper.get('[role="status"]').attributes('aria-label')).toBe('Loading expenses')

    resolveExpenses(expensePage([]))
    await flushPromises()

    expect(wrapper.text()).toContain('No expenses yet')
    expect(wrapper.text()).toContain('Create first expense')
  })

  it('renders expenses with their vendor and category', async () => {
    expensesApi.fetchExpenses.mockResolvedValue(expensePage([flight]))

    const { wrapper } = await mountPage()

    expect(wrapper.get('h1').text()).toBe('Every purchase, on the record.')
    expect(wrapper.findAll('[data-expense-record]')).toHaveLength(1)
    expect(wrapper.text()).toContain('Client-site flight')
    expect(wrapper.text()).toContain('Atlas Supplies')
    expect(wrapper.text()).toContain('Travel')
    expect(wrapper.text()).toContain('Quarterly visit')
    expect(wrapper.text()).toContain('$125.50')
    expect(wrapper.text()).toContain('1 recorded expense')
    expect(wrapper.get('[data-expense-ledger]').classes()).toContain('min-w-0')
    expect(wrapper.get('[data-expense-record]').classes()).toContain('min-w-0')
    expect(wrapper.get('[data-mobile-expense-search]').attributes('placeholder')).toBe(
      'Search expenses',
    )
    expect(wrapper.get('[aria-label="View Client-site flight"]').attributes('title')).toBe(
      'View expense',
    )
    expect(wrapper.get('[data-expense-record] [data-expense-metadata]').classes()).toEqual(
      expect.arrayContaining(['grid-cols-1', 'sm:flex']),
    )
  })

  it('loads the requested page and navigates to the previous page', async () => {
    expensesApi.fetchExpenses
      .mockResolvedValueOnce(expensePage([flight], { page: 2, totalItems: 11, totalPages: 2 }))
      .mockResolvedValueOnce(expensePage([flight], { totalItems: 11, totalPages: 2 }))

    const { router, wrapper } = await mountPage('/expenses?page=2')

    expect(expensesApi.fetchExpenses).toHaveBeenCalledWith(expenseRequest({ page: 2 }))
    expect(wrapper.text()).toContain('Page 2 of 2 · 11 expenses')
    expect(getButton(wrapper, 'Next').attributes()).toHaveProperty('disabled')

    await getButton(wrapper, 'Previous').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.query).toEqual({})
    expect(expensesApi.fetchExpenses).toHaveBeenLastCalledWith(expenseRequest())
  })

  it('shows API loading failures', async () => {
    expensesApi.fetchExpenses.mockRejectedValue(new ApiError('service unavailable'))

    const { wrapper } = await mountPage()

    expect(wrapper.get('[role="alert"]').text()).toContain('Could not load expenses')
    expect(wrapper.get('[role="alert"]').text()).toContain('Service unavailable')
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

    expect(expensesApi.fetchExpenses).toHaveBeenCalledWith(expenseRequest(filters))
    expect(getFilterField(wrapper, 'Search').element).toHaveProperty('value', 'flight')
    expect(getFilterField(wrapper, 'Vendor').element).toHaveProperty('value', atlas.id)
    expect(getFilterField(wrapper, 'Category').element).toHaveProperty('value', travel.id)
    expect(getFilterField(wrapper, 'From').element).toHaveProperty('value', '2026-08-01')
    expect(getFilterField(wrapper, 'To').element).toHaveProperty('value', '2026-08-31')
    expect(wrapper.text()).toContain('5 active')
    expect(wrapper.text()).toContain('No matching expenses')
  })

  it('loads and identifies missing proof and category filters', async () => {
    const { wrapper } = await mountPage('/expenses?proofStatus=missing&categoryStatus=missing')

    expect(expensesApi.fetchExpenses).toHaveBeenCalledWith(
      expenseRequest({ proofStatus: 'missing', categoryStatus: 'missing' }),
    )
    expect(wrapper.text()).toContain('Showing expenses without receipts and without a category.')
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
    expect(expensesApi.fetchExpenses).toHaveBeenLastCalledWith(expenseRequest(filters))
  })

  it('opens the expense form in a mobile sheet', async () => {
    stubMobileViewport()
    const { wrapper } = await mountPage()

    await getButton(wrapper, 'Add expense').trigger('click')

    expect(wrapper.get('[role="dialog"]').text()).toContain('Create expense')
    expect(wrapper.find('form[aria-label="Expense form"]').exists()).toBe(true)

    await getButton(wrapper, 'Cancel').trigger('click')
    await flushPromises()

    expect(wrapper.find('form[aria-label="Expense form"]').exists()).toBe(false)
  })

  it('applies filters from the mobile filter sheet', async () => {
    stubMobileViewport()
    expensesApi.fetchExpenses
      .mockResolvedValueOnce(expensePage([]))
      .mockResolvedValueOnce(expensePage([]))
    const { router, wrapper } = await mountPage()

    await wrapper.get('[data-mobile-filter-trigger]').trigger('click')
    const filterForm = wrapper.get('[data-mobile-filter-form]')
    await filterForm.get('#mobile-expense-vendor-filter').setValue(atlas.id)
    await filterForm.get('#mobile-expense-category-filter').setValue(travel.id)
    const dateFields = filterForm.findAll('input[type="date"]')
    expect(dateFields).toHaveLength(2)
    await dateFields[0]!.setValue('2026-08-01')
    await dateFields[1]!.setValue('2026-08-31')
    await filterForm.trigger('submit')
    await flushPromises()

    const filters = {
      vendorId: atlas.id,
      categoryId: travel.id,
      dateFrom: '2026-08-01',
      dateTo: '2026-08-31',
    }
    expect(router.currentRoute.value.query).toEqual(filters)
    expect(expensesApi.fetchExpenses).toHaveBeenLastCalledWith(expenseRequest(filters))
    expect(wrapper.find('[data-mobile-filter-form]').exists()).toBe(false)
  })

  it('synchronizes external route changes and clears active filters', async () => {
    const { router, wrapper } = await mountPage()

    await router.push('/expenses?search=hotel')
    await flushPromises()

    expect(getFilterField(wrapper, 'Search').element).toHaveProperty('value', 'hotel')
    expect(expensesApi.fetchExpenses).toHaveBeenLastCalledWith(expenseRequest({ search: 'hotel' }))

    await getButton(wrapper, 'Clear').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.query).toEqual({})
    expect(getFilterField(wrapper, 'Search').element).toHaveProperty('value', '')
    expect(expensesApi.fetchExpenses).toHaveBeenLastCalledWith(expenseRequest())
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

  it('creates an expense with loaded options and returns to the unfiltered first page', async () => {
    const hotel = expense({
      id: 'expense-2',
      description: 'Client hotel',
      amount: '300.00',
      expenseDate: '2026-08-06T00:00:00.000Z',
      notes: null,
    })
    expensesApi.fetchExpenses
      .mockResolvedValueOnce(expensePage([flight]))
      .mockResolvedValueOnce(expensePage([hotel, flight]))
    expensesApi.createExpense.mockResolvedValue(hotel)
    const { router, wrapper } = await mountPage('/expenses?search=client')

    await getButton(wrapper, 'Add expense').trigger('click')
    expect(wrapper.get('[data-expense-form-panel] h2').text()).toBe('Create expense')
    expect(getExpenseField(wrapper, 'Vendor').text()).toContain('Atlas Supplies')
    expect(getExpenseField(wrapper, 'Category').text()).toContain('Travel')

    await getExpenseField(wrapper, 'Vendor').setValue(atlas.id)
    await getExpenseField(wrapper, 'Category').setValue(travel.id)
    await getExpenseField(wrapper, 'Description').setValue('Client hotel')
    await getExpenseField(wrapper, 'Amount').setValue('300')
    await getExpenseField(wrapper, 'Expense date').setValue('2026-08-06')
    await getExpenseForm(wrapper).trigger('submit')
    await flushPromises()

    expect(expensesApi.createExpense).toHaveBeenCalledExactlyOnceWith({
      vendorId: atlas.id,
      categoryId: travel.id,
      description: 'Client hotel',
      amount: 300,
      expenseDate: '2026-08-06',
      notes: undefined,
    })
    expect(router.currentRoute.value.query).toEqual({})
    expect(expensesApi.fetchExpenses).toHaveBeenLastCalledWith(expenseRequest())
    expect(wrapper.text()).toContain('Client hotel')
    expect(wrapper.text()).toContain('Client-site flight')
    expect(wrapper.find('form[aria-label="Expense form"]').exists()).toBe(false)
  })

  it('reloads the current page after editing an expense', async () => {
    const updatedFlight = expense({ description: 'Rescheduled client-site flight' })
    expensesApi.fetchExpenses
      .mockResolvedValueOnce(expensePage([flight]))
      .mockResolvedValueOnce(expensePage([updatedFlight]))
    expensesApi.updateExpense.mockResolvedValue(updatedFlight)
    const { wrapper } = await mountPage()

    await getButton(wrapper, 'Edit').trigger('click')
    expect(wrapper.get('[data-expense-form-panel] h2').text()).toBe('Edit expense')
    await getExpenseField(wrapper, 'Description').setValue('Rescheduled client-site flight')
    await getExpenseForm(wrapper).trigger('submit')
    await flushPromises()

    expect(expensesApi.updateExpense).toHaveBeenCalledExactlyOnceWith('expense-1', {
      vendorId: atlas.id,
      categoryId: travel.id,
      description: 'Rescheduled client-site flight',
      amount: 125.5,
      expenseDate: '2026-08-05',
      notes: 'Quarterly visit',
    })
    expect(wrapper.text()).toContain('Rescheduled client-site flight')
    expect(wrapper.find('form[aria-label="Expense form"]').exists()).toBe(false)
  })

  it('archives a confirmed expense', async () => {
    expensesApi.fetchExpenses
      .mockResolvedValueOnce(expensePage([flight]))
      .mockResolvedValueOnce(expensePage([]))
    expensesApi.archiveExpense.mockResolvedValue(
      expense({ archivedAt: '2026-08-05T10:00:00.000Z' }),
    )
    const confirmMock = vi.fn<() => boolean>(() => true)
    vi.stubGlobal('confirm', confirmMock)
    const { wrapper } = await mountPage()

    await getButton(wrapper, 'Archive').trigger('click')
    await flushPromises()

    expect(confirmMock).toHaveBeenCalledExactlyOnceWith(
      'Are you sure you want to archive this expense?',
    )
    expect(expensesApi.archiveExpense).toHaveBeenCalledExactlyOnceWith('expense-1')
    expect(wrapper.text()).not.toContain('Client-site flight')
    expect(wrapper.text()).toContain('No expenses yet')
  })

  it('opens mobile record actions and edits an expense', async () => {
    stubMobileViewport()
    expensesApi.fetchExpenses.mockResolvedValue(expensePage([flight]))
    const { wrapper } = await mountPage()

    await wrapper.get('[data-mobile-record-actions]').trigger('click')

    expect(wrapper.get('[role="dialog"]').text()).toContain('Actions for Client-site flight')
    await getButton(wrapper, 'Edit expense').trigger('click')

    expect(wrapper.get('[data-expense-form-panel] h2').text()).toBe('Edit expense')
  })

  it('archives an expense from mobile record actions', async () => {
    stubMobileViewport()
    expensesApi.fetchExpenses
      .mockResolvedValueOnce(expensePage([flight]))
      .mockResolvedValueOnce(expensePage([]))
    expensesApi.archiveExpense.mockResolvedValue(
      expense({ archivedAt: '2026-08-05T10:00:00.000Z' }),
    )
    const confirmMock = vi.fn<() => boolean>(() => true)
    vi.stubGlobal('confirm', confirmMock)
    const { wrapper } = await mountPage()

    await wrapper.get('[data-mobile-record-actions]').trigger('click')
    await getButton(wrapper, 'Archive expense').trigger('click')
    await flushPromises()

    expect(confirmMock).toHaveBeenCalledExactlyOnceWith(
      'Are you sure you want to archive this expense?',
    )
    expect(expensesApi.archiveExpense).toHaveBeenCalledExactlyOnceWith('expense-1')
    expect(wrapper.text()).toContain('No expenses yet')
  })

  it('shows form validation and API field errors', async () => {
    expensesApi.createExpense.mockRejectedValue(
      new ApiError('invalid form input', { description: 'Description is already in use' }),
    )
    const { wrapper } = await mountPage()

    await getButton(wrapper, 'Add expense').trigger('click')
    await getExpenseForm(wrapper).trigger('submit')

    expect(wrapper.text()).toContain('Vendor is required')
    expect(wrapper.text()).toContain('Description is required')
    expect(wrapper.text()).toContain('Amount must be greater than 0')
    expectInvalidField(wrapper, '#expense-vendor', 'expense-vendor-error')
    expectInvalidField(wrapper, '#expense-description', 'expense-description-error')
    expectInvalidField(wrapper, '#expense-amount', 'expense-amount-error')
    expect(expensesApi.createExpense).not.toHaveBeenCalled()

    await getExpenseField(wrapper, 'Vendor').setValue(atlas.id)
    await getExpenseField(wrapper, 'Description').setValue('Client flight')
    await getExpenseField(wrapper, 'Amount').setValue('125.5')
    await getExpenseForm(wrapper).trigger('submit')
    await flushPromises()

    expectInvalidField(wrapper, '#expense-description', 'expense-description-error')
    expect(wrapper.get('#expense-description-error').text()).toBe('Description is already in use')
  })
})
