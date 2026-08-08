import { describe, expect, it } from 'vitest'
import { summarizeCategoryTotals, summarizeVendorTotals } from '@/lib/reports/category-totals'
import type { ExpenseReport, ReportInsights } from '@/lib/reports/schema'

type CategoryTotal = ExpenseReport['categoryTotals'][number]
type VendorTotal = ReportInsights['vendorTotals'][number]

function categoryTotal(number: number): CategoryTotal {
  return {
    categoryId: `category-${number}`,
    categoryName: `Category ${number}`,
    totalAmount: `${number}.50`,
    expenseCount: number,
  }
}

function vendorTotal(number: number): VendorTotal {
  return {
    vendorId: `vendor-${number}`,
    vendorName: `Vendor ${number}`,
    totalAmount: `${number}.50`,
    expenseCount: number,
  }
}

describe('report total summaries', () => {
  const categoryTotals = Array.from({ length: 7 }, (_, index) => categoryTotal(index + 1))
  const vendorTotals = Array.from({ length: 7 }, (_, index) => vendorTotal(index + 1))

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

  it('keeps up to six vendor totals unchanged', () => {
    const visibleVendors = vendorTotals.slice(0, 6)

    expect(summarizeVendorTotals(visibleVendors)).toEqual(visibleVendors)
  })

  it('groups vendor totals after the five highest entries as Other', () => {
    expect(summarizeVendorTotals(vendorTotals)).toEqual([
      ...vendorTotals.slice(0, 5),
      {
        vendorId: 'other-vendors',
        vendorName: 'Other',
        totalAmount: '14.00',
        expenseCount: 13,
      },
    ])
  })
})
