-- AlterTable
ALTER TABLE "Enquiry" ADD COLUMN     "ip" TEXT;

-- CreateIndex
CREATE INDEX "Enquiry_ip_createdAt_idx" ON "Enquiry"("ip", "createdAt");
