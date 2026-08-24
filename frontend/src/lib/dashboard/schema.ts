import { z } from 'zod'

export const dashboardSummarySchema = z.object({
  totalSpend: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/),
  activeVendors: z.number().int().nonnegative(),
  uncategorizedExpenses: z.number().int().nonnegative(),
  proofDocuments: z.number().int().nonnegative(),
  missingProofExpenses: z.number().int().nonnegative(),
  dueRecurringExpenses: z.number().int().nonnegative(),
  recentExpenses: z.array(
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
      categoryName: z.string().trim().min(1),
    }),
  ),
  recentProofs: z.array(
    z.object({
      id: z.string().trim().min(1),
      originalName: z.string().trim().min(1),
      mimeType: z.string().trim().min(1),
      sizeBytes: z.number().int().nonnegative(),
      createdAt: z.iso.datetime(),
      expenseId: z.string().trim().min(1),
      expenseDescription: z.string().trim().min(1),
    }),
  ),
  recentActivity: z.array(
    z.object({
      id: z.string().trim().min(1),
      type: z.enum(['expense', 'proof']),
      title: z.string().trim().min(1),
      subtitle: z.string().trim().min(1),
      occurredAt: z.iso.datetime(),
      expenseId: z.string().trim().min(1),
    }),
  ),

  categoryBreakdown: z.array(
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
})

export type DashboardSummary = z.infer<typeof dashboardSummarySchema>
