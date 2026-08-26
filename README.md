# Tienda de Pedales — MVP

## Levantar todo

```bash
docker compose up --build
```

- Web pública (catálogo/compra): http://localhost:3000
- Admin (carga de productos): http://localhost:3002 → login con `admin@tienda.com` / `admin123`
- API: http://localhost:3001/api

La base de datos se crea sola (Postgres) y el schema de Prisma se sincroniza al levantar el contenedor `api` (`prisma db push`).

## Flujo para probar el MVP

1. Entrá a http://localhost:3002, logueate y cargá un par de productos.
2. Entrá a http://localhost:3000, agregá un producto al carrito y andá a checkout.
3. Completá los datos y el código postal (se cotiza el envío automáticamente con el mock de Andreani).
4. Al confirmar, te redirige a una pantalla de "pago simulado" (reemplaza el checkout real de Mercado Pago). Confirmá el pago ahí.
5. La orden queda marcada como `PAID` y el stock del producto se descontó al crear la orden.

## Mercado Pago y Andreani

Por ahora `MP_MOCK=true` y `ANDREANI_MOCK=true` (ver `api/docker-compose.yml` / `.env.example`). Las integraciones están aisladas atrás de una interfaz (`PaymentProvider`, `ShippingProvider`), así que cuando tengas las credenciales reales solo hay que:

1. Escribir una clase que implemente esa interfaz usando el SDK/API real.
2. Instanciarla en `payments.service.ts` / `shipping.service.ts` en vez del mock.

No hace falta tocar `orders`, `products` ni el resto del dominio.

## Estructura

```
api/       → NestJS + Prisma + Postgres (products, orders, payments, shipping, admin-auth)
web/       → Next.js — catálogo público + checkout
admin/     → Next.js — login + CRUD de productos
```

## Pendiente para producción (no es parte del MVP)

- Credenciales reales de Mercado Pago (Checkout Pro) y validación de firma del webhook
- Credenciales reales de Andreani
- Subida de imágenes (hoy se cargan por URL)
- HTTPS, dominio, variables de entorno de producción (JWT_SECRET, ADMIN_PASSWORD)
