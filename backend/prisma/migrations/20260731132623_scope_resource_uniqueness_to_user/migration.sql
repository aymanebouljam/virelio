-- DropIndex
DROP INDEX "ExpenseCategory_name_key";

-- DropIndex
DROP INDEX "Vendor_email_key";

-- DropIndex
DROP INDEX "Vendor_name_key";

-- DropIndex
DROP INDEX "Vendor_phone_key";

-- DropIndex
DROP INDEX "Vendor_website_key";

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseCategory_userId_name_key" ON "ExpenseCategory"("userId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Vendor_userId_name_key" ON "Vendor"("userId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Vendor_userId_email_key" ON "Vendor"("userId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "Vendor_userId_phone_key" ON "Vendor"("userId", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "Vendor_userId_website_key" ON "Vendor"("userId", "website");
