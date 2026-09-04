-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "partNumber" TEXT;

-- AlterTable
ALTER TABLE "Variant" ADD COLUMN     "partNumber" TEXT;

-- CreateIndex
CREATE INDEX "Variant_partNumber_idx" ON "Variant"("partNumber");
