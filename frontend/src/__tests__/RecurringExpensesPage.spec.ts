import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import type { RouteRecordRaw } from 'vue-router'
import { ApiError, type PaginatedResponse } from '@/lib/api'
import type { ExpenseCategory } from '@/lib/expense-categories/schema'
import type { Expense } from '@/lib/expenses/schema'
import type { RecurringExpensePageParams } from '@/lib/recurring-expenses/api'
import type {
  RecurringExpensePayload,
  RecurringExpenseRecord,
  RecurringExpenseTemplate,
  RecurringExpenseUpdatePayload,
} from '@/lib/recurring-expenses/schema'
import type { Vendor } from '@/lib/vendors/schema'
import ArchivedRecurringExpensesPage from '@/pages/ArchivedRecurringExpensesPage.vue'
import RecurringExpensesPage from '@/pages/RecurringExpensesPage.vue'
import { mountWithRouter } from './test-mount'

const recurringApi = vi.hoisted(() => ({
  archiveRecurringExpense: vi.fn<(id: string) => Promise<RecurringExpenseRecord>>(),
  createRecurringExpense:
    vi.fn<(input: RecurringExpensePayload) => Promise<RecurringExpenseTemplate>>(),
  fetchArchivedRecurringExpenses: vi.fn<() => Promise<RecurringExpenseTemplate[]>>(),
  fetchRecurringExpenses:
    vi.fn<
      (params?: RecurringExpensePageParams) => Promise<PaginatedResponse<RecurringExpenseTemplate>>
    >(),
  generateRecurringExpense: vi.fn<(id: string) => Promise<Expense>>(),
  removeRecurringExpense: vi.fn<(id: string) => Promise<null>>(),
  restoreRecurringExpense: vi.fn<(id: string) => Promise<RecurringExpenseRecord>>(),
  updateRecurringExpense:
    vi.fn<
      (id: string, input: RecurringExpenseUpdatePayload) => Promise<RecurringExpenseTemplate>
    >(),
}))

const vendorsApi = vi.hoisted(() => ({
  fetchVendors: vi.fn<() => Promise<Vendor[]>>(),
}))

const categoriesApi = vi.hoisted(() => ({
  fetchExpenseCategories: vi.fn<() => Promise<ExpenseCategory[]>>(),
}))

vi.mock('@/lib/recurring-expenses/api', () => recurringApi)
vi.mock('@/lib/vendors/api', () => vendorsApi)
vi.mock('@/lib/expense-categories/api', () => categoriesApi)

const atlas: Vendor = {
  id: 'vendor-1',
  name: 'Atlas Workspace',
  email: 'hello@atlas.example',
  phone: null,
  website: 'https://atlas.example',
  notes: null,
  createdAt: '2026-08-01T09:00:00.000Z',
  updatedAt: '2026-08-01T09:00:00.000Z',
  archivedAt: null,
}

const software: ExpenseCategory = {
  id: 'category-1',
  name: 'Software',
  color: '#2563eb',
  createdAt: '2026-08-01T09:00:00.000Z',
  updatedAt: '2026-08-01T09:00:00.000Z',
  archivedAt: null,
}

const monthlyTemplate: RecurringExpenseTemplate = {
  id: 'template-1',
  vendorId: atlas.id,
  categoryId: software.id,
  description: 'Workspace subscription',
  amount: '45.5',
  currency: 'USD',
  frequency: 'MONTHLY',
  nextDueDate: '2020-08-01T00:00:00.000Z',
  notes: 'Team plan',
  createdAt: '2026-08-01T09:00:00.000Z',
  updatedAt: '2026-08-01T09:00:00.000Z',
  archivedAt: null,
  vendor: atlas,
  category: software,
}

const generatedExpense: Expense = {
  id: 'expense-1',
  vendorId: atlas.id,
  categoryId: software.id,
  description: monthlyTemplate.description,
  amount: monthlyTemplate.amount,
  expenseDate: monthlyTemplate.nextDueDate,
  notes: monthlyTemplate.notes,
  createdAt: '2026-08-01T10:00:00.000Z',
  updatedAt: '2026-08-01T10:00:00.000Z',
  archivedAt: null,
}

const archivedTemplate: RecurringExpenseTemplate = {
  ...monthlyTemplate,
  archivedAt: '2026-08-02T09:00:00.000Z',
}

const templateRecord: RecurringExpenseRecord = {
  id: monthlyTemplate.id,
  vendorId: monthlyTemplate.vendorId,
  categoryId: monthlyTemplate.categoryId,
  description: monthlyTemplate.description,
  amount: monthlyTemplate.amount,
  currency: monthlyTemplate.currency,
  frequency: monthlyTemplate.frequency,
  nextDueDate: monthlyTemplate.nextDueDate,
  notes: monthlyTemplate.notes,
  createdAt: monthlyTemplate.createdAt,
  updatedAt: monthlyTemplate.updatedAt,
  archivedAt: monthlyTemplate.archivedAt,
}

const routes: RouteRecordRaw[] = [
  {
    path: '/recurring-expenses',
    name: 'recurringExpenses',
    component: RecurringExpensesPage,
  },
  {
    path: '/recurring-expenses/archived',
    name: 'recurringExpensesArchived',
    component: ArchivedRecurringExpensesPage,
  },
]

function templatePage(
  items: RecurringExpenseTemplate[],
  pagination: Partial<PaginatedResponse<RecurringExpenseTemplate>['pagination']> = {},
): PaginatedResponse<RecurringExpenseTemplate> {
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

function getButton(wrapper: VueWrapper, text: string) {
  const button = wrapper.findAll('button').find((candidate) => candidate.text() === text)
  if (!button) throw new Error(`${text} button not found`)
  return button
}

function getFormField(wrapper: VueWrapper, label: string) {
  const field = wrapper
    .findAll('label')
    .find((candidate) => candidate.find('span').text() === label)
  if (!field) throw new Error(`${label} field not found`)
  return field.get('input, select, textarea')
}

async function fillForm(wrapper: VueWrapper) {
  await getFormField(wrapper, 'Vendor').setValue(atlas.id)
  await getFormField(wrapper, 'Category').setValue(software.id)
  await getFormField(wrapper, 'Description').setValue(monthlyTemplate.description)
  await getFormField(wrapper, 'Amount').setValue(45.5)
  await getFormField(wrapper, 'Next due date').setValue('2020-08-01')
  await getFormField(wrapper, 'Notes').setValue('Team plan')
}

async function mountActive(initialRoute = '/recurring-expenses') {
  const result = await mountWithRouter(RecurringExpensesPage, routes, initialRoute)
  await flushPromises()
  return result
}

async function mountArchived() {
  const wrapper = mount(ArchivedRecurringExpensesPage)
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  vi.resetAllMocks()
  recurringApi.fetchRecurringExpenses.mockResolvedValue(templatePage([]))
  recurringApi.fetchArchivedRecurringExpenses.mockResolvedValue([])
  vendorsApi.fetchVendors.mockResolvedValue([atlas])
  categoriesApi.fetchExpenseCategories.mockResolvedValue([software])
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('recurring expense management', () => {
  it('shows loading before rendering recurring expenses and their relations', async () => {
    let resolveTemplates!: (page: PaginatedResponse<RecurringExpenseTemplate>) => void
    recurringApi.fetchRecurringExpenses.mockReturnValue(
      new Promise<PaginatedResponse<RecurringExpenseTemplate>>((resolve) => {
        resolveTemplates = resolve
      }),
    )

    const { wrapper } = await mountWithRouter(RecurringExpensesPage, routes, '/recurring-expenses')

    expect(wrapper.get('[role="status"]').attributes('aria-label')).toBe(
      'Loading recurring expenses',
    )

    resolveTemplates(templatePage([monthlyTemplate]))
    await flushPromises()

    expect(wrapper.get('h1').text()).toBe('Know what comes due next.')
    expect(wrapper.findAll('[data-recurring-expense-record]')).toHaveLength(1)
    expect(wrapper.text()).toContain('Workspace subscription')
    expect(wrapper.text()).toContain('Atlas Workspace')
    expect(wrapper.text()).toContain('Software')
    expect(wrapper.text()).toContain('Due')
    expect(wrapper.text()).toContain('1 recurring expense planned')
    expect(wrapper.text()).toContain('45.50 USD')
  })

  it('offers a useful empty-state action', async () => {
    const { wrapper } = await mountActive()

    expect(wrapper.text()).toContain('No recurring expenses yet')
    expect(wrapper.text()).toContain('Create first schedule')
  })

  it('loads URL page queries and navigates between pages', async () => {
    const annual = { ...monthlyTemplate, id: 'template-2', description: 'Annual hosting' }
    recurringApi.fetchRecurringExpenses
      .mockResolvedValueOnce(templatePage([annual], { page: 2, totalItems: 7, totalPages: 2 }))
      .mockResolvedValueOnce(templatePage([monthlyTemplate], { totalItems: 7, totalPages: 2 }))

    const { router, wrapper } = await mountActive('/recurring-expenses?page=2')

    expect(recurringApi.fetchRecurringExpenses).toHaveBeenCalledWith({ page: 2, pageSize: 6 })
    expect(wrapper.text()).toContain('Page 2 of 2 · 7 recurring expenses')

    await getButton(wrapper, 'Previous').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.query).toEqual({})
    expect(recurringApi.fetchRecurringExpenses).toHaveBeenLastCalledWith({ page: 1, pageSize: 6 })
    expect(wrapper.text()).toContain(monthlyTemplate.description)
  })

  it('creates a recurring expense from validated form values', async () => {
    recurringApi.fetchRecurringExpenses
      .mockResolvedValueOnce(templatePage([]))
      .mockResolvedValueOnce(templatePage([monthlyTemplate]))
    recurringApi.createRecurringExpense.mockResolvedValue(monthlyTemplate)
    const { wrapper } = await mountActive()

    await getButton(wrapper, 'Add recurring expense').trigger('click')
    expect(wrapper.get('[data-recurring-expense-form-panel] h2').text()).toBe(
      'Create recurring expense',
    )
    await fillForm(wrapper)
    await wrapper.get('form[aria-label="Recurring expense form"]').trigger('submit')
    await flushPromises()

    expect(recurringApi.createRecurringExpense).toHaveBeenCalledExactlyOnceWith({
      vendorId: atlas.id,
      categoryId: software.id,
      description: monthlyTemplate.description,
      amount: 45.5,
      frequency: 'MONTHLY',
      nextDueDate: '2020-08-01',
      notes: 'Team plan',
    })
    expect(wrapper.text()).toContain(monthlyTemplate.description)
    expect(wrapper.find('form[aria-label="Recurring expense form"]').exists()).toBe(false)
  })

  it('edits an existing recurring expense', async () => {
    const updated = {
      ...monthlyTemplate,
      description: 'Annual workspace subscription',
      frequency: 'YEARLY' as const,
    }
    recurringApi.fetchRecurringExpenses
      .mockResolvedValueOnce(templatePage([monthlyTemplate]))
      .mockResolvedValueOnce(templatePage([updated]))
    recurringApi.updateRecurringExpense.mockResolvedValue(updated)
    const { wrapper } = await mountActive()

    await getButton(wrapper, 'Edit').trigger('click')
    expect(wrapper.get('[data-recurring-expense-form-panel] h2').text()).toBe(
      'Edit recurring expense',
    )
    await getFormField(wrapper, 'Description').setValue(updated.description)
    await getFormField(wrapper, 'Frequency').setValue('YEARLY')
    await wrapper.get('form[aria-label="Recurring expense form"]').trigger('submit')
    await flushPromises()

    expect(recurringApi.updateRecurringExpense).toHaveBeenCalledExactlyOnceWith(
      monthlyTemplate.id,
      {
        vendorId: atlas.id,
        categoryId: software.id,
        description: updated.description,
        amount: 45.5,
        frequency: 'YEARLY',
        nextDueDate: '2020-08-01',
        notes: 'Team plan',
      },
    )
    expect(wrapper.text()).toContain(updated.description)
  })

  it('generates a due expense and reloads the advanced schedule', async () => {
    const advanced = { ...monthlyTemplate, nextDueDate: '2099-09-01T00:00:00.000Z' }
    recurringApi.fetchRecurringExpenses
      .mockResolvedValueOnce(templatePage([monthlyTemplate]))
      .mockResolvedValueOnce(templatePage([advanced]))
    recurringApi.generateRecurringExpense.mockResolvedValue(generatedExpense)
    const { wrapper } = await mountActive()

    await getButton(wrapper, 'Generate').trigger('click')
    await flushPromises()

    expect(recurringApi.generateRecurringExpense).toHaveBeenCalledExactlyOnceWith(
      monthlyTemplate.id,
    )
    expect(getButton(wrapper, 'Generate').attributes()).toHaveProperty('disabled')
  })

  it('archives a confirmed recurring expense', async () => {
    recurringApi.fetchRecurringExpenses
      .mockResolvedValueOnce(templatePage([monthlyTemplate]))
      .mockResolvedValueOnce(templatePage([]))
    recurringApi.archiveRecurringExpense.mockResolvedValue({
      ...templateRecord,
      archivedAt: archivedTemplate.archivedAt,
    })
    const confirmMock = vi.fn<() => boolean>(() => true)
    vi.stubGlobal('confirm', confirmMock)
    const { wrapper } = await mountActive()

    await getButton(wrapper, 'Archive').trigger('click')
    await flushPromises()

    expect(confirmMock).toHaveBeenCalledExactlyOnceWith(
      'Are you sure you want to archive this recurring expense?',
    )
    expect(recurringApi.archiveRecurringExpense).toHaveBeenCalledExactlyOnceWith(monthlyTemplate.id)
    expect(wrapper.text()).toContain('No recurring expenses yet')
  })

  it('shows form validation errors', async () => {
    const { wrapper } = await mountActive()

    await getButton(wrapper, 'Add recurring expense').trigger('click')
    await wrapper.get('form[aria-label="Recurring expense form"]').trigger('submit')

    expect(wrapper.text()).toContain('Vendor is required')
    expect(wrapper.text()).toContain('Description is required')
    expect(wrapper.text()).toContain('Amount must be greater than 0')
    expect(recurringApi.createRecurringExpense).not.toHaveBeenCalled()
  })

  it('shows loading failures', async () => {
    recurringApi.fetchRecurringExpenses.mockRejectedValue(new ApiError('service unavailable'))
    const { wrapper } = await mountActive()

    expect(wrapper.get('[role="alert"]').text()).toContain('Service unavailable')
  })
})

describe('archived recurring expense management', () => {
  it('renders archived templates and identifies their actions', async () => {
    recurringApi.fetchArchivedRecurringExpenses.mockResolvedValue([archivedTemplate])
    const wrapper = await mountArchived()

    expect(wrapper.get('h1').text()).toBe('Schedules held outside the cycle.')
    expect(wrapper.findAll('[data-archived-recurring-record]')).toHaveLength(1)
    expect(wrapper.text()).toContain(archivedTemplate.description)
    expect(wrapper.text()).toContain(atlas.name)
    expect(getButton(wrapper, 'Restore').attributes('aria-label')).toBe(
      `Restore ${archivedTemplate.description}`,
    )
    expect(getButton(wrapper, 'Remove').attributes('aria-label')).toBe(
      `Remove ${archivedTemplate.description}`,
    )
  })

  it('restores a confirmed template', async () => {
    recurringApi.fetchArchivedRecurringExpenses.mockResolvedValue([archivedTemplate])
    recurringApi.restoreRecurringExpense.mockResolvedValue(templateRecord)
    vi.stubGlobal(
      'confirm',
      vi.fn<() => boolean>(() => true),
    )
    const wrapper = await mountArchived()

    await getButton(wrapper, 'Restore').trigger('click')
    await flushPromises()

    expect(recurringApi.restoreRecurringExpense).toHaveBeenCalledExactlyOnceWith(
      archivedTemplate.id,
    )
    expect(wrapper.text()).toContain('No archived recurring expenses')
  })

  it('permanently removes a confirmed template', async () => {
    recurringApi.fetchArchivedRecurringExpenses.mockResolvedValue([archivedTemplate])
    recurringApi.removeRecurringExpense.mockResolvedValue(null)
    vi.stubGlobal(
      'confirm',
      vi.fn<() => boolean>(() => true),
    )
    const wrapper = await mountArchived()

    await getButton(wrapper, 'Remove').trigger('click')
    await flushPromises()

    expect(recurringApi.removeRecurringExpense).toHaveBeenCalledExactlyOnceWith(archivedTemplate.id)
    expect(wrapper.text()).toContain('No archived recurring expenses')
  })

  it('preserves a template when permanent removal fails', async () => {
    recurringApi.fetchArchivedRecurringExpenses.mockResolvedValue([archivedTemplate])
    recurringApi.removeRecurringExpense.mockRejectedValue(
      new ApiError('recurring expense could not be removed'),
    )
    vi.stubGlobal(
      'confirm',
      vi.fn<() => boolean>(() => true),
    )
    const wrapper = await mountArchived()

    await getButton(wrapper, 'Remove').trigger('click')
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toBe('Recurring expense could not be removed')
    expect(wrapper.text()).toContain(archivedTemplate.description)
  })
})
