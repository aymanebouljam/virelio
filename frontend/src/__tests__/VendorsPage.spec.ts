import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, type VueWrapper } from '@vue/test-utils'
import type { RouteRecordRaw } from 'vue-router'
import { ApiError, type PaginatedResponse } from '@/lib/api'
import type { VendorPageFilters } from '@/lib/vendors/api'
import type { Vendor, VendorFormValues } from '@/lib/vendors/schema'
import VendorsPage from '@/pages/VendorsPage.vue'
import { mountWithRouter } from './test-mount'

const vendorsApi = vi.hoisted(() => ({
  archiveVendor: vi.fn<(id: string) => Promise<Vendor>>(),
  createVendor: vi.fn<(input: VendorFormValues) => Promise<Vendor>>(),
  fetchVendorsPage: vi.fn<(filters?: VendorPageFilters) => Promise<PaginatedResponse<Vendor>>>(),
  updateVendor: vi.fn<(id: string, input: VendorFormValues) => Promise<Vendor>>(),
}))

vi.mock('@/lib/vendors/api', () => vendorsApi)

const routes: RouteRecordRaw[] = [
  { path: '/vendors', name: 'vendors', component: VendorsPage },
  {
    path: '/vendors/:id',
    name: 'vendorDetails',
    component: { template: '<p>Vendor details</p>' },
  },
]

const atlas: Vendor = {
  id: 'vendor-1',
  name: 'Atlas Supplies',
  email: 'hello@atlas.example',
  phone: '+212600000001',
  website: 'https://atlas.example',
  notes: 'Office supplier',
  createdAt: '2026-08-04T09:00:00.000Z',
  updatedAt: '2026-08-04T09:00:00.000Z',
  archivedAt: null,
}

function vendor(overrides: Partial<Vendor>): Vendor {
  return { ...atlas, ...overrides }
}

function vendorPage(
  items: Vendor[],
  pagination: Partial<PaginatedResponse<Vendor>['pagination']> = {},
): PaginatedResponse<Vendor> {
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
  return field.get('input, textarea')
}

function getVendorForm(wrapper: VueWrapper) {
  return wrapper.get('form[aria-label="Vendor form"]')
}

function expectInvalidField(wrapper: VueWrapper, selector: string, errorId: string) {
  expect(wrapper.get(selector).attributes()).toMatchObject({
    'aria-describedby': errorId,
    'aria-invalid': 'true',
  })
  expect(wrapper.get(`#${errorId}`).text()).not.toBe('')
}

async function mountPage(initialRoute = '/vendors') {
  const result = await mountWithRouter(VendorsPage, routes, initialRoute)
  await flushPromises()
  return result
}

describe('vendor management', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vendorsApi.fetchVendorsPage.mockResolvedValue(vendorPage([]))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows loading and empty states', async () => {
    let resolveVendors!: (page: PaginatedResponse<Vendor>) => void

    vendorsApi.fetchVendorsPage.mockReturnValue(
      new Promise<PaginatedResponse<Vendor>>((resolve) => {
        resolveVendors = resolve
      }),
    )

    const { wrapper } = await mountPage()

    expect(wrapper.get('[role="status"]').attributes('aria-label')).toBe('Loading vendors')

    resolveVendors(vendorPage([]))
    await flushPromises()

    expect(wrapper.text()).toContain('No vendors yet')
    expect(wrapper.text()).toContain('Create first vendor')
  })

  it('shows API loading failures', async () => {
    vendorsApi.fetchVendorsPage.mockRejectedValue(new ApiError('service unavailable'))

    const { wrapper } = await mountPage()

    expect(wrapper.get('[role="alert"]').text()).toContain('Could not load vendors')
    expect(wrapper.get('[role="alert"]').text()).toContain('Service unavailable')
  })

  it('loads direct search queries and keeps submitted searches in the URL', async () => {
    const { router, wrapper } = await mountPage('/vendors?search=Atlas')

    expect(vendorsApi.fetchVendorsPage).toHaveBeenCalledWith({
      search: 'Atlas',
      page: 1,
      pageSize: 6,
    })
    expect(wrapper.get('input[type="search"]').element).toHaveProperty('value', 'Atlas')
    expect(wrapper.text()).toContain('Search active')
    expect(wrapper.text()).toContain('No matching vendors')

    await wrapper.get('input[type="search"]').setValue('  office supplies  ')
    await wrapper.get('form[role="search"]').trigger('submit')
    await flushPromises()

    expect(router.currentRoute.value.query).toEqual({ search: 'office supplies' })
    expect(vendorsApi.fetchVendorsPage).toHaveBeenLastCalledWith({
      search: 'office supplies',
      page: 1,
      pageSize: 6,
    })

    await getButton(wrapper, 'Clear').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.query).toEqual({})
    expect(vendorsApi.fetchVendorsPage).toHaveBeenLastCalledWith({
      search: undefined,
      page: 1,
      pageSize: 6,
    })
  })

  it('loads direct page queries and navigates between pages', async () => {
    const nova = vendor({ id: 'vendor-2', name: 'Nova Services' })
    vendorsApi.fetchVendorsPage
      .mockResolvedValueOnce(vendorPage([nova], { page: 2, totalItems: 11, totalPages: 2 }))
      .mockResolvedValueOnce(vendorPage([atlas], { page: 1, totalItems: 11, totalPages: 2 }))
    const { router, wrapper } = await mountPage('/vendors?page=2')

    expect(vendorsApi.fetchVendorsPage).toHaveBeenCalledWith({
      search: undefined,
      page: 2,
      pageSize: 6,
    })
    expect(wrapper.text()).toContain('Page 2 of 2 · 11 vendors')
    expect(getButton(wrapper, 'Next').attributes()).toHaveProperty('disabled')

    await getButton(wrapper, 'Previous').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.query).toEqual({})
    expect(vendorsApi.fetchVendorsPage).toHaveBeenLastCalledWith({
      search: undefined,
      page: 1,
      pageSize: 6,
    })
    expect(wrapper.text()).toContain('Atlas Supplies')
  })

  it('redirects an out-of-range page to the last available page', async () => {
    const nova = vendor({ id: 'vendor-2', name: 'Nova Services' })
    vendorsApi.fetchVendorsPage
      .mockResolvedValueOnce(vendorPage([], { page: 8, totalItems: 11, totalPages: 2 }))
      .mockResolvedValueOnce(vendorPage([nova], { page: 2, totalItems: 11, totalPages: 2 }))
    const { router, wrapper } = await mountPage('/vendors?page=8')

    expect(router.currentRoute.value.query).toEqual({ page: '2' })
    expect(vendorsApi.fetchVendorsPage).toHaveBeenLastCalledWith({
      search: undefined,
      page: 2,
      pageSize: 6,
    })
    expect(wrapper.text()).toContain('Nova Services')
  })

  it('creates a vendor and clears an active search', async () => {
    const nova = vendor({ id: 'vendor-2', name: 'Nova Services' })
    vendorsApi.fetchVendorsPage
      .mockResolvedValueOnce(vendorPage([atlas]))
      .mockResolvedValueOnce(vendorPage([nova, atlas]))
    vendorsApi.createVendor.mockResolvedValue(nova)
    const { router, wrapper } = await mountPage('/vendors?search=Atlas')

    await getButton(wrapper, 'Add vendor').trigger('click')
    await getFormField(wrapper, 'Name').setValue('Nova Services')
    await getVendorForm(wrapper).trigger('submit')
    await flushPromises()

    expect(vendorsApi.createVendor).toHaveBeenCalledExactlyOnceWith({
      name: 'Nova Services',
      email: undefined,
      phone: undefined,
      website: undefined,
      notes: undefined,
    })
    expect(router.currentRoute.value.query).toEqual({})
    expect(wrapper.text()).toContain('Nova Services')
    expect(wrapper.find('form[aria-label="Vendor form"]').exists()).toBe(false)
  })

  it('uses suitable input types for vendor contact details', async () => {
    const { wrapper } = await mountPage()

    await getButton(wrapper, 'Add vendor').trigger('click')

    expect(wrapper.get('#vendor-email').attributes('type')).toBe('email')
    expect(wrapper.get('#vendor-phone').attributes('type')).toBe('tel')
    expect(wrapper.get('#vendor-website').attributes('type')).toBe('url')
  })

  it('presents vendor contact details and directory count', async () => {
    vendorsApi.fetchVendorsPage.mockResolvedValue(vendorPage([atlas]))

    const { wrapper } = await mountPage()

    expect(wrapper.text()).toContain('1 vendor in your directory')
    expect(wrapper.text()).toContain('hello@atlas.example')
    expect(wrapper.text()).toContain('+212600000001')
    expect(wrapper.get('a[href="https://atlas.example"]').attributes()).toMatchObject({
      rel: 'noopener',
      target: '_blank',
    })
  })

  it('edits a vendor in place', async () => {
    const updatedAtlas = vendor({ name: 'Atlas Office Supplies' })
    vendorsApi.fetchVendorsPage.mockResolvedValue(vendorPage([atlas]))
    vendorsApi.updateVendor.mockResolvedValue(updatedAtlas)
    const { wrapper } = await mountPage()

    await getButton(wrapper, 'Edit').trigger('click')
    await getFormField(wrapper, 'Name').setValue('Atlas Office Supplies')
    await getVendorForm(wrapper).trigger('submit')
    await flushPromises()

    expect(vendorsApi.updateVendor).toHaveBeenCalledExactlyOnceWith('vendor-1', {
      name: 'Atlas Office Supplies',
      email: 'hello@atlas.example',
      phone: '+212600000001',
      website: 'https://atlas.example',
      notes: 'Office supplier',
    })
    expect(wrapper.text()).toContain('Atlas Office Supplies')
    expect(wrapper.find('form[aria-label="Vendor form"]').exists()).toBe(false)
  })

  it('archives a confirmed vendor', async () => {
    vendorsApi.fetchVendorsPage
      .mockResolvedValueOnce(vendorPage([atlas]))
      .mockResolvedValueOnce(vendorPage([]))
    vendorsApi.archiveVendor.mockResolvedValue(vendor({ archivedAt: '2026-08-04T10:00:00.000Z' }))
    const confirmMock = vi.fn<() => boolean>(() => true)
    vi.stubGlobal('confirm', confirmMock)
    const { wrapper } = await mountPage()

    await getButton(wrapper, 'Archive').trigger('click')
    await flushPromises()

    expect(confirmMock).toHaveBeenCalledExactlyOnceWith(
      'Are you sure you want to archive this vendor?',
    )
    expect(vendorsApi.archiveVendor).toHaveBeenCalledExactlyOnceWith('vendor-1')
    expect(wrapper.text()).not.toContain('Atlas Supplies')
    expect(wrapper.text()).toContain('No vendors yet')
  })

  it('shows field validation and submission errors', async () => {
    vendorsApi.createVendor.mockRejectedValue(new ApiError('vendor already exists'))
    const { wrapper } = await mountPage()

    await getButton(wrapper, 'Add vendor').trigger('click')
    await getVendorForm(wrapper).trigger('submit')

    expect(wrapper.text()).toContain('Name is required')
    expectInvalidField(wrapper, '#vendor-name', 'vendor-name-error')
    expect(vendorsApi.createVendor).not.toHaveBeenCalled()

    await getFormField(wrapper, 'Name').setValue('Atlas Supplies')
    await getVendorForm(wrapper).trigger('submit')
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toBe('Vendor already exists')
  })
})
