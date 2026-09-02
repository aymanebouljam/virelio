import { relativeDate } from './dates';

export const proofs = [
  {
    expenseDescription: 'Team collaboration software renewal',
    expenseDate: relativeDate(-143),
    originalName: 'collaboration-software-invoice.txt',
    content: [
      'Nova Tech Solutions',
      'Team collaboration software renewal',
      'Amount: 3499.00 USD',
    ].join('\n'),
  },
  {
    expenseDescription: 'Product launch photography',
    expenseDate: relativeDate(-41),
    originalName: 'product-photography-receipt.txt',
    content: [
      'PixelCraft Agency',
      'Product launch photography',
      'Amount: 3200.00 USD',
    ].join('\n'),
  },
  {
    expenseDescription: 'Emergency plumbing repair',
    expenseDate: relativeDate(-20),
    originalName: 'plumbing-repair-receipt.txt',
    content: [
      'SafeBuild Maintenance',
      'Emergency plumbing repair',
      'Amount: 1325.75 USD',
    ].join('\n'),
  },
];
