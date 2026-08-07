import { describe, expect, it } from 'vitest'
import { summarizeCategoryTotals } from '@/lib/reports/category-totals'
import type { ExpenseReport } from '@/lib/reports/schema'

type CategoryTotal = ExpenseReport['categoryTotals'][number]

function categoryTotal(number: number): CategoryTotal {
  return {
    categoryId: `category-${number}`,
    categoryName: `Category ${number}`,
    totalAmount: `${number}.50`,
    expenseCount: number,
  }
}

describe('report category totals', () => {
  const categoryTotals = Array.from({ length: 7 }, (_, index) => categoryTotal(index + 1))

  it('keeps up to six category totals unchanged', () => {
    const visibleCategories = categoryTotals.slice(0, 6)

    expect(summarizeCategoryTotals(visibleCategories)).toEqual(visibleCategories)
  })

  it('groups category totals after the five highest entries as Other', () => {
    expect(summarizeCategoryTotals(categoryTotals)).toEqual([
      ...categoryTotals.slice(0, 5),
      {
        categoryId: null,
        categoryName: 'Other',
        totalAmount: '14.00',
        expenseCount: 13,
      },
    ])
  })
})
