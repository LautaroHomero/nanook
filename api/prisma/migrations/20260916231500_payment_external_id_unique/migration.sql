-- Payment.externalId ahora es único (nullable, así que varios NULL conviven
-- sin problema): se usa como clave de idempotencia para no duplicar una
-- orden cuando el webhook y /payments/resolve confirman el mismo pago en
-- paralelo o llega un reintento.
CREATE UNIQUE INDEX "Payment_externalId_key" ON "Payment"("externalId");
