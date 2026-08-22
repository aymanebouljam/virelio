import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import type { Component } from 'vue'
import { ApiError } from '@/lib/api'
import type { ExpenseCategory } from '@/lib/expense-categories/schema'
import { formatDateTime } from '@/lib/helpers'
import type { Vendor } from '@/lib/vendors/schema'
import ArchivedExpenseCategoriesPage from '@/pages/ArchivedExpenseCategoriesPage.vue'
import ArchivedVendorsPage from '@/pages/ArchivedVendorsPage.vue'

const vendorsApi = vi.hoisted(() => ({
  fetchArchivedVendors: vi.fn<() => Promise<Vendor[]>>(),
  removeVendor: vi.fn<(id: string) => Promise<null>>(),
  restoreVendor: vi.fn<(id: string) => Promise<Vendor>>(),
}))

const categoriesApi = vi.hoisted(() => ({
  fetchArchivedExpenseCategories: vi.fn<() => Promise<ExpenseCategory[]>>(),
  removeExpenseCategory: vi.fn<(id: string) => Promise<null>>(),
  restoreExpenseCategory: vi.fn<(id: string) => Promise<ExpenseCategory>>(),
}))

vi.mock('@/lib/vendors/api', () => vendorsApi)
vi.mock('@/lib/expense-categories/api', () => categoriesApi)

const archivedAt = '2026-08-04T10:00:00.000Z'

const atlas: Vendor = {
  id: 'vendor-1',
  name: 'Atlas Supplies',
  email: 'hello@atlas.example',
  phone: '+212600000001',
  website: 'https://atlas.example',
  notes: 'Office supplier',
  createdAt: '2026-08-04T09:00:00.000Z',
  updatedAt: '2026-08-04T10:00:00.000Z',
  archivedAt,
}

const travel: ExpenseCategory = {
  id: 'category-1',
  name: 'Travel',
  color: '#2563eb',
  createdAt: '2026-08-04T09:00:00.000Z',
  updatedAt: '2026-08-04T10:00:00.000Z',
  archivedAt,
}

function getButton(wrapper: VueWrapper, text: string) {
  const button = wrapper.findAll('button').find((candidate) => candidate.text() === text)
  if (!button) throw new Error(`${text} button not found`)
  return button
}

async function mountPage(component: Component) {
  const wrapper = mount(component)
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  vi.resetAllMocks()
  vendorsApi.fetchArchivedVendors.mockResolvedValue([])
  categoriesApi.fetchArchivedExpenseCategories.mockResolvedValue([])
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('archived vendor management', () => {
  it('shows loading and empty states', async () => {
    let resolveVendors!: (vendors: Vendor[]) => void
    vendorsApi.fetchArchivedVendors.mockReturnValue(
      new Promise<Vendor[]>((resolve) => {
        resolveVendors = resolve
      }),
    )

    const wrapper = await mountPage(ArchivedVendorsPage)

    expect(wrapper.get('[role="status"]').attributes('aria-label')).toBe('Loading archived vendors')

    resolveVendors([])
    await flushPromises()

    expect(wrapper.text()).toContain('No archived vendors')
  })

  it('shows API loading failures', async () => {
    vendorsApi.fetchArchivedVendors.mockRejectedValue(new ApiError('service unavailable'))

    const wrapper = await mountPage(ArchivedVendorsPage)

    expect(wrapper.get('[role="alert"]').text()).toContain('Could not load archived vendors')
    expect(wrapper.get('[role="alert"]').text()).toContain('Service unavailable')
  })

  it('shows when a vendor was archived', async () => {
    vendorsApi.fetchArchivedVendors.mockResolvedValue([atlas])

    const wrapper = await mountPage(ArchivedVendorsPage)
    const archiveTime = wrapper.get('time')

    expect(wrapper.get('h1').text()).toBe('Vendors held outside active records.')
    expect(wrapper.findAll('[data-archived-vendor-record]')).toHaveLength(1)
    expect(archiveTime.attributes('datetime')).toBe(archivedAt)
    expect(archiveTime.text()).toBe(formatDateTime(archivedAt))
  })

  it('identifies which vendor archive actions affect', async () => {
    vendorsApi.fetchArchivedVendors.mockResolvedValue([atlas])

    const wrapper = await mountPage(ArchivedVendorsPage)

    expect(getButton(wrapper, 'Restore').attributes('aria-label')).toBe('Restore Atlas Supplies')
    expect(getButton(wrapper, 'Remove').attributes('aria-label')).toBe('Remove Atlas Supplies')
  })

  it('restores a confirmed vendor', async () => {
    vendorsApi.fetchArchivedVendors.mockResolvedValue([atlas])
    vendorsApi.restoreVendor.mockResolvedValue({ ...atlas, archivedAt: null })
    const confirmMock = vi.fn<() => boolean>(() => true)
    vi.stubGlobal('confirm', confirmMock)
    const wrapper = await mountPage(ArchivedVendorsPage)

    await getButton(wrapper, 'Restore').trigger('click')
    await flushPromises()

    expect(confirmMock).toHaveBeenCalledExactlyOnceWith(
      'Are you sure you want to restore this vendor?',
    )
    expect(vendorsApi.restoreVendor).toHaveBeenCalledExactlyOnceWith('vendor-1')
    expect(wrapper.text()).not.toContain('Atlas Supplies')
    expect(wrapper.text()).toContain('No archived vendors')
  })

  it('permanently removes a confirmed vendor', async () => {
    vendorsApi.fetchArchivedVendors.mockResolvedValue([atlas])
    vendorsApi.removeVendor.mockResolvedValue(null)
    vi.stubGlobal(
      'confirm',
      vi.fn<() => boolean>(() => true),
    )
    const wrapper = await mountPage(ArchivedVendorsPage)

    await getButton(wrapper, 'Remove').trigger('click')
    await flushPromises()

    expect(vendorsApi.removeVendor).toHaveBeenCalledExactlyOnceWith('vendor-1')
    expect(wrapper.text()).not.toContain('Atlas Supplies')
    expect(wrapper.text()).toContain('No archived vendors')
  })

  it('keeps a vendor visible when permanent removal conflicts', async () => {
    vendorsApi.fetchArchivedVendors.mockResolvedValue([atlas])
    vendorsApi.removeVendor.mockRejectedValue(new ApiError('vendor has linked expenses'))
    vi.stubGlobal(
      'confirm',
      vi.fn<() => boolean>(() => true),
    )
    const wrapper = await mountPage(ArchivedVendorsPage)

    await getButton(wrapper, 'Remove').trigger('click')
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toBe('Vendor has linked expenses')
    expect(wrapper.text()).toContain('Atlas Supplies')
  })
})

describe('archived category management', () => {
  it('shows loading and empty states', async () => {
    let resolveCategories!: (categories: ExpenseCategory[]) => void
    categoriesApi.fetchArchivedExpenseCategories.mockReturnValue(
      new Promise<ExpenseCategory[]>((resolve) => {
        resolveCategories = resolve
      }),
    )

    const wrapper = await mountPage(ArchivedExpenseCategoriesPage)

    expect(wrapper.get('[role="status"]').attributes('aria-label')).toBe(
      'Loading archived categories',
    )

    resolveCategories([])
    await flushPromises()

    expect(wrapper.text()).toContain('No archived categories')
  })

  it('shows API loading failures', async () => {
    categoriesApi.fetchArchivedExpenseCategories.mockRejectedValue(
      new ApiError('service unavailable'),
    )

    const wrapper = await mountPage(ArchivedExpenseCategoriesPage)

    expect(wrapper.get('[role="alert"]').text()).toContain('Could not load archived categories')
    expect(wrapper.get('[role="alert"]').text()).toContain('Service unavailable')
  })

  it('shows when a category was archived', async () => {
    categoriesApi.fetchArchivedExpenseCategories.mockResolvedValue([travel])

    const wrapper = await mountPage(ArchivedExpenseCategoriesPage)
    const archiveTime = wrapper.get('time')

    expect(wrapper.get('h1').text()).toBe('Categories held outside active records.')
    expect(wrapper.findAll('[data-archived-category-record]')).toHaveLength(1)
    expect(archiveTime.attributes('datetime')).toBe(archivedAt)
    expect(archiveTime.text()).toBe(formatDateTime(archivedAt))
  })

  it('identifies which category archive actions affect', async () => {
    categoriesApi.fetchArchivedExpenseCategories.mockResolvedValue([travel])

    const wrapper = await mountPage(ArchivedExpenseCategoriesPage)

    expect(getButton(wrapper, 'Restore').attributes('aria-label')).toBe('Restore Travel')
    expect(getButton(wrapper, 'Remove').attributes('aria-label')).toBe('Remove Travel')
  })

  it('restores a confirmed category', async () => {
    categoriesApi.fetchArchivedExpenseCategories.mockResolvedValue([travel])
    categoriesApi.restoreExpenseCategory.mockResolvedValue({ ...travel, archivedAt: null })
    const confirmMock = vi.fn<() => boolean>(() => true)
    vi.stubGlobal('confirm', confirmMock)
    const wrapper = await mountPage(ArchivedExpenseCategoriesPage)

    await getButton(wrapper, 'Restore').trigger('click')
    await flushPromises()

    expect(confirmMock).toHaveBeenCalledExactlyOnceWith(
      'Are you sure you want to restore this category?',
    )
    expect(categoriesApi.restoreExpenseCategory).toHaveBeenCalledExactlyOnceWith('category-1')
    expect(wrapper.text()).not.toContain('Travel')
    expect(wrapper.text()).toContain('No archived categories')
  })

  it('permanently removes a confirmed category', async () => {
    categoriesApi.fetchArchivedExpenseCategories.mockResolvedValue([travel])
    categoriesApi.removeExpenseCategory.mockResolvedValue(null)
    vi.stubGlobal(
      'confirm',
      vi.fn<() => boolean>(() => true),
    )
    const wrapper = await mountPage(ArchivedExpenseCategoriesPage)

    await getButton(wrapper, 'Remove').trigger('click')
    await flushPromises()

    expect(categoriesApi.removeExpenseCategory).toHaveBeenCalledExactlyOnceWith('category-1')
    expect(wrapper.text()).not.toContain('Travel')
    expect(wrapper.text()).toContain('No archived categories')
  })

  it('keeps a category visible when permanent removal conflicts', async () => {
    categoriesApi.fetchArchivedExpenseCategories.mockResolvedValue([travel])
    categoriesApi.removeExpenseCategory.mockRejectedValue(
      new ApiError('category has linked expenses'),
    )
    vi.stubGlobal(
      'confirm',
      vi.fn<() => boolean>(() => true),
    )
    const wrapper = await mountPage(ArchivedExpenseCategoriesPage)

    await getButton(wrapper, 'Remove').trigger('click')
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toBe('Category has linked expenses')
    expect(wrapper.text()).toContain('Travel')
  })
})
