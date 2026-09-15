-- CreateEnum
CREATE TYPE "ShippingMethod" AS ENUM ('SUCURSAL', 'DOMICILIO');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "shippingMethod" "ShippingMethod" NOT NULL DEFAULT 'DOMICILIO';

-- AlterTable
ALTER TABLE "ShippingRate" DROP COLUMN "cost",
ADD COLUMN     "costDomicilio" DECIMAL(10,2) NOT NULL,
ADD COLUMN     "costSucursal" DECIMAL(10,2) NOT NULL;

