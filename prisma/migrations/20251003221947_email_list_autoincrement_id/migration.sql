-- AlterTable
ALTER TABLE "TrackingEvent" ADD COLUMN     "emailListId" INTEGER;

-- CreateTable
CREATE TABLE "EmailList" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "country" TEXT,
    "ipaddress" TEXT,
    "os" TEXT,
    "browser" TEXT,
    "lang" TEXT,
    "timezone" TEXT,
    "openCount" INTEGER NOT NULL DEFAULT 0,
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "unsubCount" INTEGER NOT NULL DEFAULT 0,
    "lastEvent" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailList_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailList_email_key" ON "EmailList"("email");

-- CreateIndex
CREATE INDEX "EmailList_email_idx" ON "EmailList"("email");

-- AddForeignKey
ALTER TABLE "TrackingEvent" ADD CONSTRAINT "TrackingEvent_emailListId_fkey" FOREIGN KEY ("emailListId") REFERENCES "EmailList"("id") ON DELETE SET NULL ON UPDATE CASCADE;
