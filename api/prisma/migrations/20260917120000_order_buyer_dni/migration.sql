-- DNI o CUIT del comprador, pedido en el checkout desde ahora. Las órdenes
-- ya existentes quedan con "" (no hay forma de reconstruir el dato).
ALTER TABLE "Order" ADD COLUMN "buyerDni" TEXT NOT NULL DEFAULT '';
