import { apiConfig } from '../api'
import type { CategoryComparison, ExpenseReport, ReportInsights } from './schema'

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

export async function downloadExpenseReportCsv(params: ReportDateRangeParams = {}) {
  return (await apiConfig({
    path: 'reports',
    action: 'expenses.csv',
    queryParams: {
      ...(params.dateFrom ? { dateFrom: params.dateFrom } : {}),
      ...(params.dateTo ? { dateTo: params.dateTo } : {}),
    },
    responseType: 'blob',
  })) as Blob
}

export async function fetchCategoryComparison(params: Required<ReportDateRangeParams>) {
  return (await apiConfig({
    path: 'reports',
    action: 'category-comparison',
    queryParams: params,
  })) as CategoryComparison
}
