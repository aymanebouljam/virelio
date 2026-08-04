import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, type VueWrapper } from '@vue/test-utils'
import type { RouteRecordRaw } from 'vue-router'
import { ApiError } from '@/lib/api'
import type { Vendor, VendorFormValues } from '@/lib/vendors/schema'
import VendorsPage from '@/pages/VendorsPage.vue'
import { mountWithRouter } from './test-mount'

const vendorsApi = vi.hoisted(() => ({
  archiveVendor: vi.fn<(id: string) => Promise<Vendor>>(),
  createVendor: vi.fn<(input: VendorFormValues) => Promise<Vendor>>(),
  fetchVendors: vi.fn<(filters?: { search?: string }) => Promise<Vendor[]>>(),
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

async function mountPage(initialRoute = '/vendors') {
  const result = await mountWithRouter(VendorsPage, routes, initialRoute)
  await flushPromises()
  return result
}

describe('vendor management', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vendorsApi.fetchVendors.mockResolvedValue([])
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows loading and empty states', async () => {
    let resolveVendors!: (vendors: Vendor[]) => void

    vendorsApi.fetchVendors.mockReturnValue(
      new Promise<Vendor[]>((resolve) => {
        resolveVendors = resolve
      }),
    )

    const { wrapper } = await mountPage()

    expect(wrapper.get('[role="status"]').attributes('aria-label')).toBe('Loading vendors')

    resolveVendors([])
    await flushPromises()

    expect(wrapper.text()).toContain('No vendors yet')
  })

  it('shows API loading failures', async () => {
    vendorsApi.fetchVendors.mockRejectedValue(new ApiError('service unavailable'))

    const { wrapper } = await mountPage()

    expect(wrapper.text()).toContain('Could not load vendors')
    expect(wrapper.text()).toContain('Service unavailable')
  })

  it('loads direct search queries and keeps submitted searches in the URL', async () => {
    const { router, wrapper } = await mountPage('/vendors?search=Atlas')

    expect(vendorsApi.fetchVendors).toHaveBeenCalledWith({ search: 'Atlas' })
    expect(wrapper.get('input[type="search"]').element).toHaveProperty('value', 'Atlas')
    expect(wrapper.text()).toContain('No matching vendors')

    await wrapper.get('input[type="search"]').setValue('  office supplies  ')
    await wrapper.get('form[role="search"]').trigger('submit')
    await flushPromises()

    expect(router.currentRoute.value.query).toEqual({ search: 'office supplies' })
    expect(vendorsApi.fetchVendors).toHaveBeenLastCalledWith({ search: 'office supplies' })

    await getButton(wrapper, 'Clear').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.query).toEqual({})
    expect(vendorsApi.fetchVendors).toHaveBeenLastCalledWith({ search: undefined })
  })

  it('creates a vendor and clears an active search', async () => {
    const nova = vendor({ id: 'vendor-2', name: 'Nova Services' })
    vendorsApi.fetchVendors.mockResolvedValueOnce([atlas]).mockResolvedValueOnce([nova, atlas])
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

  it('edits a vendor in place', async () => {
    const updatedAtlas = vendor({ name: 'Atlas Office Supplies' })
    vendorsApi.fetchVendors.mockResolvedValue([atlas])
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
    vendorsApi.fetchVendors.mockResolvedValue([atlas])
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
    expect(vendorsApi.createVendor).not.toHaveBeenCalled()

    await getFormField(wrapper, 'Name').setValue('Atlas Supplies')
    await getVendorForm(wrapper).trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('Vendor already exists')
  })
})
