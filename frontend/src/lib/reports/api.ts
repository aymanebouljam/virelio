import { apiConfig } from '../api'
import type { ExpenseReport, ReportInsights } from './schema'

type ReportDateRangeParams = {
  dateFrom?: string
  dateTo?: string
}

type FetchExpenseReportParams = ReportDateRangeParams & {
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

export async function fetchReportInsights(params: ReportDateRangeParams = {}) {
  return (await apiConfig({
    path: 'reports',
    action: 'insights',
    queryParams: {
      ...(params.dateFrom ? { dateFrom: params.dateFrom } : {}),
      ...(params.dateTo ? { dateTo: params.dateTo } : {}),
    },
  })) as ReportInsights
}
