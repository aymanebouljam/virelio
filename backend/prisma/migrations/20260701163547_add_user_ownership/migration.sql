-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "userId" UUID NOT NULL;

-- AlterTable
ALTER TABLE "ExpenseCategory" ADD COLUMN     "userId" UUID NOT NULL;

-- AlterTable
ALTER TABLE "Vendor" ADD COLUMN     "userId" UUID NOT NULL;

-- AddForeignKey
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseCategory" ADD CONSTRAINT "ExpenseCategory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
