import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { ShippingModule } from '../shipping/shipping.module';
import { PaymentsModule } from '../payments/payments.module';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';

@Module({
  imports: [ShippingModule, PaymentsModule, AdminAuthModule],
  providers: [OrdersService],
  controllers: [OrdersController],
})
export class OrdersModule {}
