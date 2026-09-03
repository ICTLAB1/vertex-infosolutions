-- CreateTable
CREATE TABLE "SignInAttempt" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignInAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SignInAttempt_email_ip_createdAt_idx" ON "SignInAttempt"("email", "ip", "createdAt");

-- CreateIndex
CREATE INDEX "SignInAttempt_ip_createdAt_idx" ON "SignInAttempt"("ip", "createdAt");

-- CreateIndex
CREATE INDEX "SignInAttempt_email_createdAt_idx" ON "SignInAttempt"("email", "createdAt");
