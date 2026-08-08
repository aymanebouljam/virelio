import { z } from 'zod'

const amountSchema = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/)

const signedAmountSchema = z
  .string()
  .trim()
  .regex(/^-?\d+(\.\d{1,2})?$/)

const reportDateSchema = z.iso.date()

const expenseRowSchema = z.object({
  id: z.string().trim().min(1),
  description: z.string().trim().min(1),
  amount: amountSchema,
  expenseDate: z.iso.datetime(),
  vendorId: z.string().trim().min(1),
  vendorName: z.string().trim().min(1),
  categoryId: z.string().trim().min(1).nullable(),
  categoryName: z.string().trim().min(1),
  notes: z.string().trim().nullable(),
})

export const expenseReportSchema = z.object({
  totalAmount: amountSchema,
  expenseCount: z.number().int().nonnegative(),
  categoryTotals: z.array(
    z.object({
      categoryId: z.string().trim().min(1).nullable(),
      categoryName: z.string().trim().min(1),
      totalAmount: amountSchema,
      expenseCount: z.number().int().nonnegative(),
    }),
  ),
  expenses: z.object({
    items: z.array(expenseRowSchema),
    pagination: z.object({
      page: z.number().int().positive(),
      pageSize: z.number().int().positive(),
      totalItems: z.number().int().nonnegative(),
      totalPages: z.number().int().nonnegative(),
    }),
  }),
})

export const reportInsightsSchema = z.object({
  monthlyTotals: z.array(
    z.object({
      month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
      totalAmount: amountSchema,
      expenseCount: z.number().int().nonnegative(),
    }),
  ),
  vendorTotals: z.array(
    z.object({
      vendorId: z.string().trim().min(1),
      vendorName: z.string().trim().min(1),
      totalAmount: amountSchema,
      expenseCount: z.number().int().nonnegative(),
    }),
  ),
})

const categoryComparisonPeriodSchema = z.object({
  dateFrom: reportDateSchema,
  dateTo: reportDateSchema,
  totalAmount: amountSchema,
  expenseCount: z.number().int().nonnegative(),
})

export const categoryComparisonSchema = z.object({
  currentPeriod: categoryComparisonPeriodSchema,
  previousPeriod: categoryComparisonPeriodSchema,
  categories: z.array(
    z.object({
      categoryId: z.string().trim().min(1).nullable(),
      categoryName: z.string().trim().min(1),
      currentAmount: amountSchema,
      previousAmount: amountSchema,
      changeAmount: signedAmountSchema,
      changePercentage: z.number().finite().nullable(),
    }),
  ),
})

export type ExpenseReport = z.infer<typeof expenseReportSchema>
export type ReportInsights = z.infer<typeof reportInsightsSchema>
export type CategoryComparison = z.infer<typeof categoryComparisonSchema>
