import { z } from 'zod'
import { expenseCategorySchema } from '../expense-categories/schema'
import { vendorSchema } from '../vendors/schema'

export const recurrenceFrequencySchema = z.enum(['WEEKLY', 'MONTHLY', 'YEARLY'])

export type RecurrenceFrequency = z.infer<typeof recurrenceFrequencySchema>

export const recurringExpenseFormSchema = z.object({
  vendorId: z.string().trim().min(1, 'Vendor is required'),
  categoryId: z.string().trim(),
  description: z
    .string()
    .trim()
    .min(1, 'Description is required')
    .max(240, 'Description must be at most 240 characters'),
  amount: z.number({ error: 'Amount is required' }).min(0.01, 'Amount must be greater than 0'),
  frequency: recurrenceFrequencySchema,
  nextDueDate: z.string().trim().min(1, 'Next due date is required'),
  notes: z.string().trim().max(1000, 'Notes must be at most 1000 characters'),
})

export type RecurringExpenseFormValues = z.infer<typeof recurringExpenseFormSchema>

export type RecurringExpensePayload = {
  vendorId: string
  categoryId?: string
  description: string
  amount: number
  frequency: RecurrenceFrequency
  nextDueDate: string
  notes?: string
}

export type RecurringExpenseUpdatePayload = Partial<
  Omit<RecurringExpensePayload, 'categoryId' | 'notes'>
> & {
  categoryId?: string | null
  notes?: string | null
}

export const recurringExpenseRecordSchema = z.object({
  id: z.string().trim().min(1),
  vendorId: z.string().trim().min(1),
  categoryId: z.string().trim().nullable(),
  description: z.string().trim().min(1).max(240),
  amount: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/),
  currency: z.string().trim().length(3),
  frequency: recurrenceFrequencySchema,
  nextDueDate: z.iso.datetime(),
  notes: z.string().trim().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  archivedAt: z.iso.datetime().nullable(),
})

export type RecurringExpenseRecord = z.infer<typeof recurringExpenseRecordSchema>

export const recurringExpenseTemplateSchema = recurringExpenseRecordSchema.extend({
  vendor: vendorSchema,
  category: expenseCategorySchema.nullable(),
})

export type RecurringExpenseTemplate = z.infer<typeof recurringExpenseTemplateSchema>
