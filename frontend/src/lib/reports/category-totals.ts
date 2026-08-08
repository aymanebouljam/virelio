import type { ExpenseReport, ReportInsights } from './schema'

type CategoryTotal = ExpenseReport['categoryTotals'][number]
type VendorTotal = ReportInsights['vendorTotals'][number]
type ReportTotal = Pick<CategoryTotal, 'totalAmount' | 'expenseCount'>

const TOTAL_LIMIT = 6
const VISIBLE_TOTAL_LIMIT = TOTAL_LIMIT - 1

function summarizeRemainingTotals(totals: ReportTotal[]) {
  return totals.slice(VISIBLE_TOTAL_LIMIT).reduce(
    (summary, total) => ({
      amountInCents: summary.amountInCents + Math.round(Number(total.totalAmount) * 100),
      expenseCount: summary.expenseCount + total.expenseCount,
    }),
    { amountInCents: 0, expenseCount: 0 },
  )
}

export function summarizeCategoryTotals(categoryTotals: CategoryTotal[]): CategoryTotal[] {
  if (categoryTotals.length <= TOTAL_LIMIT) return categoryTotals
  const other = summarizeRemainingTotals(categoryTotals)

  return [
    ...categoryTotals.slice(0, VISIBLE_TOTAL_LIMIT),
    {
      categoryId: null,
      categoryName: 'Other',
      totalAmount: (other.amountInCents / 100).toFixed(2),
      expenseCount: other.expenseCount,
    },
  ]
}

export function summarizeVendorTotals(vendorTotals: VendorTotal[]): VendorTotal[] {
  if (vendorTotals.length <= TOTAL_LIMIT) return vendorTotals
  const other = summarizeRemainingTotals(vendorTotals)

  return [
    ...vendorTotals.slice(0, VISIBLE_TOTAL_LIMIT),
    {
      vendorId: 'other-vendors',
      vendorName: 'Other',
      totalAmount: (other.amountInCents / 100).toFixed(2),
      expenseCount: other.expenseCount,
    },
  ]
}
