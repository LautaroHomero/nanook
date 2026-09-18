-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "surchargeAmount" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "receiptUrl" TEXT;
