import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
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
})
export class AppModule {}
