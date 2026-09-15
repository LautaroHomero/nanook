import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { ProductsModule } from './products/products.module';
import { CategoriesModule } from './categories/categories.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { ShippingModule } from './shipping/shipping.module';
import { AdminAuthModule } from './admin-auth/admin-auth.module';
import { BrandsModule } from './brands/brands.module';
import { UploadsModule } from './uploads/uploads.module';
import { NotificationsModule } from './notifications/notification.module';
import { ProductRequestsModule } from './product-request/product-request.module';
import { StockAlertsModule } from './stock-alerts/stock-alerts.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    PrismaModule,
    ProductsModule,
    CategoriesModule,
    BrandsModule,
    OrdersModule,
    PaymentsModule,
    ShippingModule,
    UploadsModule,
    AdminAuthModule,
    NotificationsModule,
    ProductRequestsModule,
    StockAlertsModule,
  ],
  controllers: [AppController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
