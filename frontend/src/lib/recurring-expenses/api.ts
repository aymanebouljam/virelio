import { apiConfig, type PaginatedResponse } from '../api'
import type { Expense } from '../expenses/schema'
import type {
  RecurringExpensePayload,
  RecurringExpenseTemplate,
  RecurringExpenseUpdatePayload,
} from './schema'

export type RecurringExpensePageParams = {
  page?: number
  pageSize?: number
}

export async function fetchRecurringExpenses({
  page = 1,
  pageSize = 6,
}: RecurringExpensePageParams = {}) {
  return (await apiConfig({
    path: 'recurring-expenses',
    queryParams: { page, pageSize },
  })) as PaginatedResponse<RecurringExpenseTemplate>
}

export async function fetchArchivedRecurringExpenses() {
  return (await apiConfig({
    path: 'recurring-expenses',
    action: 'archived',
  })) as RecurringExpenseTemplate[]
}

export async function fetchRecurringExpense(id: string) {
  return (await apiConfig({ path: 'recurring-expenses', id })) as RecurringExpenseTemplate
}

export async function createRecurringExpense(input: RecurringExpensePayload) {
  return (await apiConfig({
    path: 'recurring-expenses',
    method: 'POST',
    input,
  })) as RecurringExpenseTemplate
}

export async function updateRecurringExpense(id: string, input: RecurringExpenseUpdatePayload) {
  return (await apiConfig({
    path: 'recurring-expenses',
    method: 'PATCH',
    id,
    input,
  })) as RecurringExpenseTemplate
}

export async function archiveRecurringExpense(id: string) {
  return (await apiConfig({
    path: 'recurring-expenses',
    method: 'PATCH',
    id,
    action: 'archive',
  })) as RecurringExpenseTemplate
}

export async function restoreRecurringExpense(id: string) {
  return (await apiConfig({
    path: 'recurring-expenses',
    method: 'PATCH',
    id,
    action: 'restore',
  })) as RecurringExpenseTemplate
}

export async function generateRecurringExpense(id: string) {
  return (await apiConfig({
    path: 'recurring-expenses',
    method: 'POST',
    id,
    action: 'generate',
  })) as Expense
}

export async function removeRecurringExpense(id: string): Promise<null> {
  return (await apiConfig({
    path: 'recurring-expenses',
    method: 'DELETE',
    id,
  })) as null
}
