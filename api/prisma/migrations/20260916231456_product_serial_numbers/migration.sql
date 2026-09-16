-- CreateEnum
CREATE TYPE "ProductSerialStatus" AS ENUM ('IN_STOCK', 'SHIPPED');

-- CreateTable
CREATE TABLE "ProductSerial" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "status" "ProductSerialStatus" NOT NULL DEFAULT 'IN_STOCK',
    "shipmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "shippedAt" TIMESTAMP(3),

    CONSTRAINT "ProductSerial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductSerial_serialNumber_key" ON "ProductSerial"("serialNumber");

-- CreateIndex
CREATE INDEX "ProductSerial_productId_idx" ON "ProductSerial"("productId");

-- CreateIndex
CREATE INDEX "ProductSerial_shipmentId_idx" ON "ProductSerial"("shipmentId");

-- AddForeignKey
ALTER TABLE "ProductSerial" ADD CONSTRAINT "ProductSerial_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSerial" ADD CONSTRAINT "ProductSerial_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
