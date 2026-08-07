import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, type VueWrapper } from '@vue/test-utils'
import type { RouteRecordRaw } from 'vue-router'
import { ApiError, type PaginatedResponse } from '@/lib/api'
import type { ExpenseCategoryPageParams } from '@/lib/expense-categories/api'
import type { ExpenseCategory, ExpenseCategoryFormValues } from '@/lib/expense-categories/schema'
import ExpenseCategoriesPage from '@/pages/ExpenseCategoriesPage.vue'
import { mountWithRouter } from './test-mount'

const categoriesApi = vi.hoisted(() => ({
  archiveExpenseCategory: vi.fn<(id: string) => Promise<ExpenseCategory>>(),
  createExpenseCategory: vi.fn<(input: ExpenseCategoryFormValues) => Promise<ExpenseCategory>>(),
  fetchExpenseCategoriesPage:
    vi.fn<(params?: ExpenseCategoryPageParams) => Promise<PaginatedResponse<ExpenseCategory>>>(),
  updateExpenseCategory:
    vi.fn<(id: string, input: ExpenseCategoryFormValues) => Promise<ExpenseCategory>>(),
}))

vi.mock('@/lib/expense-categories/api', () => categoriesApi)

const routes: RouteRecordRaw[] = [
  {
    path: '/expense-categories',
    name: 'expenseCategories',
    component: ExpenseCategoriesPage,
  },
]

const travel: ExpenseCategory = {
  id: 'category-1',
  name: 'Travel',
  color: '#2563eb',
  createdAt: '2026-08-04T09:00:00.000Z',
  updatedAt: '2026-08-04T09:00:00.000Z',
  archivedAt: null,
}

function category(overrides: Partial<ExpenseCategory>): ExpenseCategory {
  return { ...travel, ...overrides }
}

function categoryPage(
  items: ExpenseCategory[],
  pagination: Partial<PaginatedResponse<ExpenseCategory>['pagination']> = {},
): PaginatedResponse<ExpenseCategory> {
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
  return field.get('input')
}

function getCategoryForm(wrapper: VueWrapper) {
  return wrapper.get('form[aria-label="Category form"]')
}

function expectInvalidField(wrapper: VueWrapper, selector: string, errorId: string) {
  expect(wrapper.get(selector).attributes()).toMatchObject({
    'aria-describedby': errorId,
    'aria-invalid': 'true',
  })
  expect(wrapper.get(`#${errorId}`).text()).not.toBe('')
}

async function mountPage(initialRoute = '/expense-categories') {
  const result = await mountWithRouter(ExpenseCategoriesPage, routes, initialRoute)
  await flushPromises()
  return result
}

describe('expense category management', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    categoriesApi.fetchExpenseCategoriesPage.mockResolvedValue(categoryPage([]))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows loading and empty states', async () => {
    let resolveCategories!: (page: PaginatedResponse<ExpenseCategory>) => void
    categoriesApi.fetchExpenseCategoriesPage.mockReturnValue(
      new Promise<PaginatedResponse<ExpenseCategory>>((resolve) => {
        resolveCategories = resolve
      }),
    )

    const { wrapper } = await mountPage()

    expect(wrapper.get('[role="status"]').attributes('aria-label')).toBe('Loading categories')

    resolveCategories(categoryPage([]))
    await flushPromises()

    expect(wrapper.text()).toContain('No categories yet')
  })

  it('loads direct page queries and navigates between pages', async () => {
    const meals = category({ id: 'category-2', name: 'Meals' })
    categoriesApi.fetchExpenseCategoriesPage
      .mockResolvedValueOnce(categoryPage([meals], { page: 2, totalItems: 7, totalPages: 2 }))
      .mockResolvedValueOnce(categoryPage([travel], { totalItems: 7, totalPages: 2 }))

    const { router, wrapper } = await mountPage('/expense-categories?page=2')

    expect(categoriesApi.fetchExpenseCategoriesPage).toHaveBeenCalledWith({
      page: 2,
      pageSize: 6,
    })
    expect(wrapper.text()).toContain('Page 2 of 2 · 7 categories')
    expect(getButton(wrapper, 'Next').attributes()).toHaveProperty('disabled')

    await getButton(wrapper, 'Previous').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.query).toEqual({})
    expect(categoriesApi.fetchExpenseCategoriesPage).toHaveBeenLastCalledWith({
      page: 1,
      pageSize: 6,
    })
    expect(wrapper.text()).toContain('Travel')
  })

  it('redirects an out-of-range page to the last available page', async () => {
    const meals = category({ id: 'category-2', name: 'Meals' })
    categoriesApi.fetchExpenseCategoriesPage
      .mockResolvedValueOnce(categoryPage([], { page: 8, totalItems: 7, totalPages: 2 }))
      .mockResolvedValueOnce(categoryPage([meals], { page: 2, totalItems: 7, totalPages: 2 }))

    const { router, wrapper } = await mountPage('/expense-categories?page=8')

    expect(router.currentRoute.value.query).toEqual({ page: '2' })
    expect(categoriesApi.fetchExpenseCategoriesPage).toHaveBeenLastCalledWith({
      page: 2,
      pageSize: 6,
    })
    expect(wrapper.text()).toContain('Meals')
  })

  it('shows API loading failures', async () => {
    categoriesApi.fetchExpenseCategoriesPage.mockRejectedValue(new ApiError('service unavailable'))

    const { wrapper } = await mountPage()

    expect(wrapper.get('[role="alert"]').text()).toContain('Could not load categories')
    expect(wrapper.get('[role="alert"]').text()).toContain('Service unavailable')
  })

  it('creates a category', async () => {
    const meals = category({ id: 'category-2', name: 'Meals', color: '#64748b' })
    categoriesApi.fetchExpenseCategoriesPage
      .mockResolvedValueOnce(categoryPage([], { page: 2, totalItems: 7, totalPages: 2 }))
      .mockResolvedValueOnce(categoryPage([meals], { totalItems: 7, totalPages: 2 }))
    categoriesApi.createExpenseCategory.mockResolvedValue(meals)
    const { router, wrapper } = await mountPage('/expense-categories?page=2')

    await getButton(wrapper, 'Add category').trigger('click')
    await getFormField(wrapper, 'Name').setValue('Meals')
    await getCategoryForm(wrapper).trigger('submit')
    await flushPromises()

    expect(categoriesApi.createExpenseCategory).toHaveBeenCalledExactlyOnceWith({
      name: 'Meals',
      color: '#64748b',
    })
    expect(router.currentRoute.value.query).toEqual({})
    expect(wrapper.text()).toContain('Meals')
    expect(wrapper.find('form[aria-label="Category form"]').exists()).toBe(false)
  })

  it('edits a category in place', async () => {
    const updatedTravel = category({ name: 'Business travel', color: '#0f766e' })
    categoriesApi.fetchExpenseCategoriesPage.mockResolvedValue(categoryPage([travel]))
    categoriesApi.updateExpenseCategory.mockResolvedValue(updatedTravel)
    const { wrapper } = await mountPage()

    await getButton(wrapper, 'Edit').trigger('click')
    await getFormField(wrapper, 'Name').setValue('Business travel')
    await getFormField(wrapper, 'Color').setValue('#0f766e')
    await getCategoryForm(wrapper).trigger('submit')
    await flushPromises()

    expect(categoriesApi.updateExpenseCategory).toHaveBeenCalledExactlyOnceWith('category-1', {
      name: 'Business travel',
      color: '#0f766e',
    })
    expect(wrapper.text()).toContain('Business travel')
    expect(wrapper.find('form[aria-label="Category form"]').exists()).toBe(false)
  })

  it('archives a confirmed category', async () => {
    categoriesApi.fetchExpenseCategoriesPage
      .mockResolvedValueOnce(categoryPage([travel]))
      .mockResolvedValueOnce(categoryPage([]))
    categoriesApi.archiveExpenseCategory.mockResolvedValue(
      category({ archivedAt: '2026-08-04T10:00:00.000Z' }),
    )
    const confirmMock = vi.fn<() => boolean>(() => true)
    vi.stubGlobal('confirm', confirmMock)
    const { wrapper } = await mountPage()

    await getButton(wrapper, 'Archive').trigger('click')
    await flushPromises()

    expect(confirmMock).toHaveBeenCalledExactlyOnceWith(
      'Are you sure you want to archive this category?',
    )
    expect(categoriesApi.archiveExpenseCategory).toHaveBeenCalledExactlyOnceWith('category-1')
    expect(wrapper.text()).not.toContain('Travel')
    expect(wrapper.text()).toContain('No categories yet')
  })

  it('shows field validation and submission errors', async () => {
    categoriesApi.createExpenseCategory.mockRejectedValue(new ApiError('category already exists'))
    const { wrapper } = await mountPage()

    await getButton(wrapper, 'Add category').trigger('click')
    await getCategoryForm(wrapper).trigger('submit')

    expect(wrapper.text()).toContain('Name is required')
    expectInvalidField(wrapper, '#category-name', 'category-name-error')
    expect(categoriesApi.createExpenseCategory).not.toHaveBeenCalled()

    await getFormField(wrapper, 'Name').setValue('Travel')
    await getCategoryForm(wrapper).trigger('submit')
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toBe('Category already exists')
  })
})
