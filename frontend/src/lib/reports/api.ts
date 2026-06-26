import { apiConfig } from '../api'
import type { ExpenseReport } from './schema'

type FetchExpenseReportParams = {
  dateFrom?: string
  dateTo?: string
}

export async function fetchExpenseReport(params: FetchExpenseReportParams = {}) {
  return (await apiConfig({
    path: 'reports',
    action: 'expenses',
    queryParams: {
      ...(params.dateFrom ? { dateFrom: params.dateFrom } : {}),
      ...(params.dateTo ? { dateTo: params.dateTo } : {}),
    },
  })) as ExpenseReport
}
