import { apiConfig } from '../api'
import type { Expense, ExpenseFormValues } from './schema'

export async function fetchExpenses() {
  return (await apiConfig({ path: 'expenses' })) as Expense[]
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
  })) as Expense
}

export async function createExpense(input: ExpenseFormValues) {
  return (await apiConfig({
    path: 'expenses',
    method: 'POST',
    input,
  })) as Expense
}

export async function updateExpense(id: string, input: Partial<ExpenseFormValues>) {
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
