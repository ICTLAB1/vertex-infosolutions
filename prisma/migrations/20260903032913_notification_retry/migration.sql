-- AlterEnum
ALTER TYPE "NotificationStatus" ADD VALUE 'ABANDONED';

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "lastAttemptAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Notification_status_lastAttemptAt_idx" ON "Notification"("status", "lastAttemptAt");
