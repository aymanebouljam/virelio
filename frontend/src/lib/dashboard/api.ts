import { apiConfig } from '../api'
import type { DashboardSummary } from './schema'

export async function fetchDashboardSummary() {
  return (await apiConfig({
    path: 'dashboard',
    action: 'summary',
  })) as DashboardSummary
}
