import { z } from 'zod'

export const expenseFormSchema = z.object({
  vendorId: z.string().trim().min(1, 'Vendor is required'),
  categoryId: z.string().trim(),
  description: z
    .string()
    .trim()
    .min(1, 'Description is required')
    .max(240, 'Description must be at most 240 characters'),
  amount: z.number({ error: 'Amount is required' }).min(0.01, 'Amount must be greater than 0'),
  expenseDate: z.string().trim().min(1, 'Expense date is required'),
  notes: z.string().trim().max(1000, 'Notes must be at most 1000 characters'),
})

export type ExpenseFormValues = z.infer<typeof expenseFormSchema>

export type ExpensePayload = {
  vendorId: string
  categoryId?: string
  description: string
  amount: number
  expenseDate: string
  notes?: string
}

export const expenseSchema = z.object({
  id: z.string().trim().min(1),
  vendorId: z.string().trim().min(1),
  categoryId: z.string().trim().nullable(),
  description: z.string().trim().min(1).max(240),
  amount: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/, {
      message: 'Amount must be a positive number with up to 2 decimal places',
    }),
  expenseDate: z.iso.datetime(),
  notes: z.string().trim().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  archivedAt: z.iso.datetime().nullable(),
})

export type Expense = z.infer<typeof expenseSchema>

export const expenseDetailSchema = expenseSchema.extend({
  vendor: z.object({
    id: z.string().trim().min(1),
    name: z.string().trim().min(1),
    email: z.string().trim().nullable(),
    phone: z.string().trim().nullable(),
    website: z.string().trim().nullable(),
    notes: z.string().trim().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    archivedAt: z.iso.datetime().nullable(),
  }),
  category: z
    .object({
      id: z.string().trim().min(1),
      name: z.string().trim().min(1).max(120),
      color: z.string().trim().nullable(),
      createdAt: z.iso.datetime(),
      updatedAt: z.iso.datetime(),
      archivedAt: z.iso.datetime().nullable(),
    })
    .nullable(),
  proofs: z.array(
    z.object({
      id: z.string().trim().min(1),
      expenseId: z.string().trim().min(1),
      originalName: z.string().trim().min(1),
      mimeType: z.string().trim().min(1),
      sizeBytes: z.number().int().nonnegative(),
      createdAt: z.iso.datetime(),
    }),
  ),
})

export type ExpenseDetail = z.infer<typeof expenseDetailSchema>
