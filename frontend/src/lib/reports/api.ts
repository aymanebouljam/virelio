import { apiConfig } from '../api'
import type { ExpenseReport } from './schema'

type FetchExpenseReportParams = {
  dateFrom?: string
  dateTo?: string
  page?: number
  pageSize?: number
}

export async function fetchExpenseReport({
  page = 1,
  pageSize = 10,
  ...params
}: FetchExpenseReportParams = {}) {
  return (await apiConfig({
    path: 'reports',
    action: 'expenses',
    queryParams: {
      ...(params.dateFrom ? { dateFrom: params.dateFrom } : {}),
      ...(params.dateTo ? { dateTo: params.dateTo } : {}),
      page,
      pageSize,
    },
  })) as ExpenseReport
}
