-- AlterTable
ALTER TABLE "ServiceJob" ADD COLUMN     "branchId" TEXT;

-- CreateIndex
CREATE INDEX "ServiceJob_branchId_idx" ON "ServiceJob"("branchId");

-- AddForeignKey
ALTER TABLE "ServiceJob" ADD CONSTRAINT "ServiceJob_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill ServiceJob.branchId from linked Order.branchId
UPDATE "ServiceJob" sj
SET "branchId" = o."branchId"
FROM "Order" o
WHERE sj."orderId" = o."id"
  AND sj."branchId" IS NULL
  AND o."branchId" IS NOT NULL;

-- Backfill ServiceJob.branchId from assigned Technician's Staff.branchId
UPDATE "ServiceJob" sj
SET "branchId" = s."branchId"
FROM "Staff" s
WHERE sj."technicianId" = s."id"
  AND sj."branchId" IS NULL
  AND s."branchId" IS NOT NULL;
