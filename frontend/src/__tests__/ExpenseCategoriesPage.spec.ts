import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { ApiError } from '@/lib/api'
import type { ExpenseCategory, ExpenseCategoryFormValues } from '@/lib/expense-categories/schema'
import ExpenseCategoriesPage from '@/pages/ExpenseCategoriesPage.vue'

const categoriesApi = vi.hoisted(() => ({
  archiveExpenseCategory: vi.fn<(id: string) => Promise<ExpenseCategory>>(),
  createExpenseCategory: vi.fn<(input: ExpenseCategoryFormValues) => Promise<ExpenseCategory>>(),
  fetchExpenseCategories: vi.fn<() => Promise<ExpenseCategory[]>>(),
  updateExpenseCategory:
    vi.fn<(id: string, input: ExpenseCategoryFormValues) => Promise<ExpenseCategory>>(),
}))

vi.mock('@/lib/expense-categories/api', () => categoriesApi)

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

async function mountPage() {
  const wrapper = mount(ExpenseCategoriesPage)
  await flushPromises()
  return wrapper
}

describe('expense category management', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    categoriesApi.fetchExpenseCategories.mockResolvedValue([])
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows loading and empty states', async () => {
    let resolveCategories!: (categories: ExpenseCategory[]) => void
    categoriesApi.fetchExpenseCategories.mockReturnValue(
      new Promise<ExpenseCategory[]>((resolve) => {
        resolveCategories = resolve
      }),
    )

    const wrapper = await mountPage()

    expect(wrapper.get('[role="status"]').attributes('aria-label')).toBe('Loading categories')

    resolveCategories([])
    await flushPromises()

    expect(wrapper.text()).toContain('No categories yet')
  })

  it('shows API loading failures', async () => {
    categoriesApi.fetchExpenseCategories.mockRejectedValue(new ApiError('service unavailable'))

    const wrapper = await mountPage()

    expect(wrapper.text()).toContain('Could not load categories')
    expect(wrapper.text()).toContain('Service unavailable')
  })

  it('creates a category', async () => {
    const meals = category({ id: 'category-2', name: 'Meals', color: '#64748b' })
    categoriesApi.createExpenseCategory.mockResolvedValue(meals)
    const wrapper = await mountPage()

    await getButton(wrapper, 'Add category').trigger('click')
    await getFormField(wrapper, 'Name').setValue('Meals')
    await getCategoryForm(wrapper).trigger('submit')
    await flushPromises()

    expect(categoriesApi.createExpenseCategory).toHaveBeenCalledExactlyOnceWith({
      name: 'Meals',
      color: '#64748b',
    })
    expect(wrapper.text()).toContain('Meals')
    expect(wrapper.find('form[aria-label="Category form"]').exists()).toBe(false)
  })

  it('edits a category in place', async () => {
    const updatedTravel = category({ name: 'Business travel', color: '#0f766e' })
    categoriesApi.fetchExpenseCategories.mockResolvedValue([travel])
    categoriesApi.updateExpenseCategory.mockResolvedValue(updatedTravel)
    const wrapper = await mountPage()

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
    categoriesApi.fetchExpenseCategories.mockResolvedValue([travel])
    categoriesApi.archiveExpenseCategory.mockResolvedValue(
      category({ archivedAt: '2026-08-04T10:00:00.000Z' }),
    )
    const confirmMock = vi.fn<() => boolean>(() => true)
    vi.stubGlobal('confirm', confirmMock)
    const wrapper = await mountPage()

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
    const wrapper = await mountPage()

    await getButton(wrapper, 'Add category').trigger('click')
    await getCategoryForm(wrapper).trigger('submit')

    expect(wrapper.text()).toContain('Name is required')
    expect(categoriesApi.createExpenseCategory).not.toHaveBeenCalled()

    await getFormField(wrapper, 'Name').setValue('Travel')
    await getCategoryForm(wrapper).trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('Category already exists')
  })
})
