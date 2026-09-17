-- CreateEnum
CREATE TYPE "ShippingZone" AS ENUM ('AMBA', 'CENTRO', 'INTERMEDIO', 'EXTREMO');

-- CreateTable
CREATE TABLE "ShippingZoneRate" (
    "id" TEXT NOT NULL,
    "zone" "ShippingZone" NOT NULL,
    "costSucursal" DECIMAL(10,2) NOT NULL,
    "costDomicilio" DECIMAL(10,2) NOT NULL,
    "estimatedDays" INTEGER NOT NULL DEFAULT 7,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShippingZoneRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShippingZoneRate_zone_key" ON "ShippingZoneRate"("zone");
