import { expenses } from './expenses';

export const proofs = expenses
  .filter((expense) => expense.includeProof !== false)
  .map((expense, index) => ({
    expenseDescription: expense.description,
    expenseDate: expense.expenseDate,
    originalName: `expense-proof-${String(index + 1).padStart(2, '0')}.txt`,
    content: [
      expense.vendorName,
      expense.description,
      `Amount: ${expense.amount} USD`,
    ].join('\n'),
  }));
