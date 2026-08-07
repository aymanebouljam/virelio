import type { ExpenseReport } from './schema'

type CategoryTotal = ExpenseReport['categoryTotals'][number]

const CATEGORY_TOTAL_LIMIT = 6
const VISIBLE_CATEGORY_LIMIT = CATEGORY_TOTAL_LIMIT - 1

export function summarizeCategoryTotals(categoryTotals: CategoryTotal[]): CategoryTotal[] {
  if (categoryTotals.length <= CATEGORY_TOTAL_LIMIT) return categoryTotals

  const other = categoryTotals.slice(VISIBLE_CATEGORY_LIMIT).reduce(
    (totals, category) => ({
      amountInCents: totals.amountInCents + Math.round(Number(category.totalAmount) * 100),
      expenseCount: totals.expenseCount + category.expenseCount,
    }),
    { amountInCents: 0, expenseCount: 0 },
  )

  return [
    ...categoryTotals.slice(0, VISIBLE_CATEGORY_LIMIT),
    {
      categoryId: null,
      categoryName: 'Other',
      totalAmount: (other.amountInCents / 100).toFixed(2),
      expenseCount: other.expenseCount,
    },
  ]
}
