import { apiConfig } from '../api'
import type { ExpenseCategory, ExpenseCategoryFormValues } from './schema'

export async function fetchExpenseCategories() {
  return (await apiConfig({ path: 'expense-categories' })) as ExpenseCategory[]
}

export async function fetchArchivedExpenseCategories() {
  return (await apiConfig({
    path: 'expense-categories',
    action: 'archived',
  })) as ExpenseCategory[]
}

export async function createExpenseCategory(input: ExpenseCategoryFormValues) {
  return (await apiConfig({
    path: 'expense-categories',
    method: 'POST',
    input,
  })) as ExpenseCategory
}

export async function updateExpenseCategory(id: string, input: ExpenseCategoryFormValues) {
  return (await apiConfig({
    path: 'expense-categories',
    method: 'PATCH',
    id,
    input,
  })) as ExpenseCategory
}

export async function archiveExpenseCategory(id: string) {
  return (await apiConfig({
    path: 'expense-categories',
    method: 'PATCH',
    id,
    action: 'archive',
  })) as ExpenseCategory
}

export async function restoreExpenseCategory(id: string) {
  return (await apiConfig({
    path: 'expense-categories',
    method: 'PATCH',
    id,
    action: 'restore',
  })) as ExpenseCategory
}
