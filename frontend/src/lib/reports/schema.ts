import { z } from 'zod'

export const expenseReportSchema = z.object({
  totalAmount: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/),
  expenseCount: z.number().int().nonnegative(),
  categoryTotals: z.array(
    z.object({
      categoryId: z.string().trim().min(1).nullable(),
      categoryName: z.string().trim().min(1),
      totalAmount: z
        .string()
        .trim()
        .regex(/^\d+(\.\d{1,2})?$/),
      expenseCount: z.number().int().nonnegative(),
    }),
  ),
  expenses: z.array(
    z.object({
      id: z.string().trim().min(1),
      description: z.string().trim().min(1),
      amount: z
        .string()
        .trim()
        .regex(/^\d+(\.\d{1,2})?$/),
      expenseDate: z.iso.datetime(),
      vendorId: z.string().trim().min(1),
      vendorName: z.string().trim().min(1),
      categoryId: z.string().trim().min(1).nullable(),
      categoryName: z.string().trim().min(1),
      notes: z.string().trim().nullable(),
    }),
  ),
})

export type ExpenseReport = z.infer<typeof expenseReportSchema>
