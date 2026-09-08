import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { StockAlertsModule } from '../stock-alerts/stock-alerts.module';

@Module({
  imports: [AdminAuthModule, StockAlertsModule],
  providers: [ProductsService],
  controllers: [ProductsController],
  exports: [ProductsService],
})
export class ProductsModule {}
