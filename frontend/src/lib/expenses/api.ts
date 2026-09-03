import { apiConfig, type PaginatedResponse } from '../api'
import type { Expense, ExpenseDetail, ExpensePayload } from './schema'

export type ExpenseFilters = {
  search?: string
  vendorId?: string
  categoryId?: string
  proofStatus?: 'missing'
  categoryStatus?: 'missing'
  dateFrom?: string
  dateTo?: string
  page?: number
  pageSize?: number
}

export async function fetchExpenses({ page = 1, pageSize = 10, ...filters }: ExpenseFilters = {}) {
  return (await apiConfig({
    path: 'expenses',
    queryParams: {
      ...Object.fromEntries(Object.entries(filters).filter(([, value]) => Boolean(value))),
      page,
      pageSize,
    },
  })) as PaginatedResponse<Expense>
}

export async function fetchArchivedExpenses() {
  return (await apiConfig({
    path: 'expenses',
    action: 'archived',
  })) as Expense[]
}

export async function fetchExpense(id: string) {
  return (await apiConfig({
    path: 'expenses',
    id,
  })) as ExpenseDetail
}

export async function createExpense(input: ExpensePayload) {
  return (await apiConfig({
    path: 'expenses',
    method: 'POST',
    input,
  })) as Expense
}

export async function updateExpense(id: string, input: Partial<ExpensePayload>) {
  return (await apiConfig({
    path: 'expenses',
    method: 'PATCH',
    id,
    input,
  })) as Expense
}

export async function archiveExpense(id: string) {
  return (await apiConfig({
    path: 'expenses',
    method: 'PATCH',
    id,
    action: 'archive',
  })) as Expense
}

export async function restoreExpense(id: string) {
  return (await apiConfig({
    path: 'expenses',
    method: 'PATCH',
    id,
    action: 'restore',
  })) as Expense
}

export async function removeExpense(id: string): Promise<null> {
  return (await apiConfig({
    path: 'expenses',
    method: 'DELETE',
    id,
  })) as null
}
