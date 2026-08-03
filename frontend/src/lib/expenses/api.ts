import { apiConfig } from '../api'
import type { Expense, ExpenseDetail, ExpensePayload } from './schema'

export type ExpenseFilters = {
  search?: string
  vendorId?: string
  categoryId?: string
  dateFrom?: string
  dateTo?: string
}

export async function fetchExpenses(filters: ExpenseFilters = {}) {
  const queryParams = Object.fromEntries(
    Object.entries(filters).filter((entry): entry is [string, string] => Boolean(entry[1])),
  )

  return (await apiConfig({
    path: 'expenses',
    queryParams,
  })) as Expense[]
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
