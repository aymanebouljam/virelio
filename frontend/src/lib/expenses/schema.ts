import { z } from 'zod'

export const expenseFormSchema = z.object({
  vendorId: z.string().trim().min(1, 'Vendor is required'),
  categoryId: z.string().trim().optional().or(z.literal('')),
  description: z
    .string()
    .trim()
    .min(1, 'Description is required')
    .max(240, 'Description must be at most 240 characters'),
  amount: z.number({ error: 'Amount is required' }).min(0.01, 'Amount must be greater than 0'),
  expenseDate: z.iso.datetime({ error: 'Expense date must be a valid ISO datetime' }),
  notes: z
    .string()
    .trim()
    .max(1000, 'Notes must be at most 1000 characters')
    .optional()
    .or(z.literal('')),
})

export type ExpenseFormValues = z.infer<typeof expenseFormSchema>

export const expenseSchema = z.object({
  id: z.string().trim().min(1),
  vendorId: z.string().trim().min(1),
  categoryId: z.string().trim().nullable(),
  description: z.string().trim().min(1).max(240),
  amount: z.string().trim().min(1),
  expenseDate: z.iso.datetime(),
  notes: z.string().trim().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  archivedAt: z.iso.datetime().nullable(),
})

export type Expense = z.infer<typeof expenseSchema>
