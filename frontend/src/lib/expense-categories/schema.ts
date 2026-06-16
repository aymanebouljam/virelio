import { z } from 'zod'

export const expenseCategoryFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(120, 'Name must be at most 120 characters'),
  color: z
    .string()
    .trim()
    .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Color must be a valid hex color')
    .optional()
    .or(z.literal('')),
})

export type ExpenseCategoryFormValues = z.infer<typeof expenseCategoryFormSchema>

export const expenseCategorySchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1).max(120),
  color: z.string().trim().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  archivedAt: z.iso.datetime().nullable(),
})

export type ExpenseCategory = z.infer<typeof expenseCategorySchema>
