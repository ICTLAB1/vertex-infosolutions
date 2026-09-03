-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "renewalRemindedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "OrderItem_expiresAt_renewalRemindedAt_idx" ON "OrderItem"("expiresAt", "renewalRemindedAt");
