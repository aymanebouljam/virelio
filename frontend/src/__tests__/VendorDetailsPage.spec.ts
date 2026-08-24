import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import type { RouteRecordRaw } from 'vue-router'
import { ApiError } from '@/lib/api'
import { formatDateTime } from '@/lib/helpers'
import type { Vendor } from '@/lib/vendors/schema'
import VendorDetailsPage from '@/pages/VendorDetailsPage.vue'
import { mountWithRouter } from './test-mount'
import { createTestRouter } from './test-router'

const vendorsApi = vi.hoisted(() => ({
  archiveVendor: vi.fn<(id: string) => Promise<Vendor>>(),
  fetchVendor: vi.fn<(id: string) => Promise<Vendor>>(),
}))

vi.mock('@/lib/vendors/api', () => vendorsApi)

const atlas: Vendor = {
  id: 'vendor-1',
  name: 'Atlas Supplies',
  email: 'hello@atlas.example',
  phone: '+212600000001',
  website: 'https://atlas.example',
  notes: 'Office supplier',
  createdAt: '2026-08-04T09:00:00.000Z',
  updatedAt: '2026-08-04T10:00:00.000Z',
  archivedAt: null,
}

const routes: RouteRecordRaw[] = [
  { path: '/vendors', name: 'vendors', component: { template: '<p>Vendor list</p>' } },
  { path: '/vendors/archived', name: 'vendorsArchived', component: { template: '<p>Archive</p>' } },
  { path: '/vendors/:id', name: 'vendorDetails', component: VendorDetailsPage },
]

function getButton(wrapper: VueWrapper, text: string) {
  const button = wrapper.findAll('button').find((candidate) => candidate.text() === text)
  if (!button) throw new Error(`${text} button not found`)
  return button
}

async function mountPage() {
  const result = await mountWithRouter(VendorDetailsPage, routes, '/vendors/vendor-1')
  await flushPromises()
  return result
}

beforeEach(() => {
  vi.resetAllMocks()
  vendorsApi.fetchVendor.mockResolvedValue(atlas)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('vendor details', () => {
  it('returns to the previous page', async () => {
    const router = await createTestRouter(routes, '/vendors')
    await router.push('/vendors/vendor-1')
    const wrapper = mount(VendorDetailsPage, {
      global: {
        plugins: [router],
      },
    })
    await flushPromises()

    await getButton(wrapper, 'Back').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.fullPath).toBe('/vendors')
  })

  it('presents the active vendor dossier', async () => {
    const { wrapper } = await mountPage()
    const timestamps = wrapper.findAll('time')

    expect(vendorsApi.fetchVendor).toHaveBeenCalledExactlyOnceWith('vendor-1')
    expect(wrapper.get('h1').text()).toBe('Atlas Supplies')
    expect(wrapper.findAll('[data-vendor-record]')).toHaveLength(1)
    expect(wrapper.text()).toContain('hello@atlas.example')
    expect(wrapper.text()).toContain('+212600000001')
    expect(wrapper.get('a[href="https://atlas.example"]').attributes()).toMatchObject({
      rel: 'noopener',
      target: '_blank',
    })
    expect(timestamps).toHaveLength(2)
    expect(timestamps[0]?.attributes('datetime')).toBe(atlas.createdAt)
    expect(timestamps[0]?.text()).toBe(formatDateTime(atlas.createdAt))
    expect(timestamps[1]?.attributes('datetime')).toBe(atlas.updatedAt)
  })

  it('shows loading and API failure states', async () => {
    let rejectVendor!: (error: ApiError) => void
    vendorsApi.fetchVendor.mockReturnValue(
      new Promise<Vendor>((_resolve, reject) => {
        rejectVendor = reject
      }),
    )

    const { wrapper } = await mountWithRouter(VendorDetailsPage, routes, '/vendors/vendor-1')

    expect(wrapper.get('[role="status"]').attributes('aria-label')).toBe('Loading vendor details')

    rejectVendor(new ApiError('service unavailable'))
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toContain('Could not load vendor')
    expect(wrapper.get('[role="alert"]').text()).toContain('Service unavailable')
  })

  it('archives a confirmed vendor and opens the archive', async () => {
    vendorsApi.archiveVendor.mockResolvedValue({ ...atlas, archivedAt: atlas.updatedAt })
    const confirmMock = vi.fn<() => boolean>(() => true)
    vi.stubGlobal('confirm', confirmMock)
    const { router, wrapper } = await mountPage()

    await getButton(wrapper, 'Archive vendor').trigger('click')
    await flushPromises()

    expect(confirmMock).toHaveBeenCalledExactlyOnceWith(
      'Are you sure you want to archive this vendor?',
    )
    expect(vendorsApi.archiveVendor).toHaveBeenCalledExactlyOnceWith('vendor-1')
    expect(router.currentRoute.value.name).toBe('vendorsArchived')
  })

  it('keeps the vendor visible when archiving fails', async () => {
    vendorsApi.archiveVendor.mockRejectedValue(new ApiError('vendor has linked expenses'))
    vi.stubGlobal(
      'confirm',
      vi.fn<() => boolean>(() => true),
    )
    const { wrapper } = await mountPage()

    await getButton(wrapper, 'Archive vendor').trigger('click')
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toBe('Vendor has linked expenses')
    expect(wrapper.text()).toContain('Atlas Supplies')
  })
})
