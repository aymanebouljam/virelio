-- CreateTable
CREATE TABLE "ProofDocument" (
    "id" UUID NOT NULL,
    "expenseId" UUID NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storagePath" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProofDocument_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ProofDocument" ADD CONSTRAINT "ProofDocument_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;
