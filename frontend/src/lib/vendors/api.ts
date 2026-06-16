import { apiConfig } from '../api'
import type { Vendor, VendorFormValues } from './schema'

export async function fetchVendors() {
  return (await apiConfig({ path: 'vendors' })) as Vendor[]
}

export async function fetchVendor(id: string) {
  return (await apiConfig({ path: 'vendors', id })) as Vendor
}

export async function createVendor(input: VendorFormValues) {
  return (await apiConfig({ path: 'vendors', method: 'POST', input })) as Vendor
}

export async function updateVendor(id: string, input: VendorFormValues) {
  return (await apiConfig({ path: 'vendors', method: 'PATCH', input, id })) as Vendor
}
export async function archiveVendor(id: string) {
  return (await apiConfig({ path: 'vendors', method: 'PATCH', id, action: 'archive' })) as Vendor
}

export async function fetchArchivedVendors() {
  return (await apiConfig({ path: 'vendors', action: 'archived' })) as Vendor[]
}

export async function restoreVendor(id: string) {
  return (await apiConfig({ path: 'vendors', method: 'PATCH', id, action: 'restore' })) as Vendor
}

export async function removeVendor(id: string) {
  return (await apiConfig({ path: 'vendors', method: 'DELETE', id })) as null
}
