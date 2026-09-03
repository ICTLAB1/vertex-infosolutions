-- CreateEnum
CREATE TYPE "AuthAttemptKind" AS ENUM ('SIGN_IN', 'PASSWORD_RESET');

-- DropIndex
DROP INDEX "SignInAttempt_email_createdAt_idx";

-- DropIndex
DROP INDEX "SignInAttempt_email_ip_createdAt_idx";

-- DropIndex
DROP INDEX "SignInAttempt_ip_createdAt_idx";

-- AlterTable
ALTER TABLE "SignInAttempt" ADD COLUMN     "kind" "AuthAttemptKind" NOT NULL DEFAULT 'SIGN_IN';

-- CreateIndex
CREATE INDEX "SignInAttempt_kind_email_ip_createdAt_idx" ON "SignInAttempt"("kind", "email", "ip", "createdAt");

-- CreateIndex
CREATE INDEX "SignInAttempt_kind_ip_createdAt_idx" ON "SignInAttempt"("kind", "ip", "createdAt");

-- CreateIndex
CREATE INDEX "SignInAttempt_kind_email_createdAt_idx" ON "SignInAttempt"("kind", "email", "createdAt");
