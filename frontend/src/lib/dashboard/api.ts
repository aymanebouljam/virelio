import { apiConfig } from '../api'
import type { DashboardSummary } from './schema'

type FetchDashboardSummaryParams = {
  dateFrom?: string
  dateTo?: string
}

export async function fetchDashboardSummary(params: FetchDashboardSummaryParams = {}) {
  return (await apiConfig({
    path: 'dashboard',
    action: 'summary',
    queryParams: {
      ...(params.dateFrom ? { dateFrom: params.dateFrom } : {}),
      ...(params.dateTo ? { dateTo: params.dateTo } : {}),
    },
  })) as DashboardSummary
}
