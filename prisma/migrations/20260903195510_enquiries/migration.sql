-- CreateEnum
CREATE TYPE "EnquiryKind" AS ENUM ('GENERAL', 'VOLUME_QUOTE', 'LICENSING');

-- CreateTable
CREATE TABLE "Enquiry" (
    "id" TEXT NOT NULL,
    "kind" "EnquiryKind" NOT NULL DEFAULT 'GENERAL',
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "company" TEXT,
    "phone" TEXT,
    "message" TEXT NOT NULL,
    "productSlug" TEXT,
    "currency" CHAR(3),
    "country" CHAR(2),
    "handledAt" TIMESTAMP(3),
    "handledBy" TEXT,
    "handledNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Enquiry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Enquiry_handledAt_createdAt_idx" ON "Enquiry"("handledAt", "createdAt");

-- CreateIndex
CREATE INDEX "Enquiry_email_idx" ON "Enquiry"("email");
