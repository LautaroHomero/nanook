import { Module } from '@nestjs/common';
import { ProductRequestsService } from './product-request.service';
import { ProductRequestsController } from './product-request.controller';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { NotificationsModule } from '../notifications/notification.module';

@Module({
  imports: [AdminAuthModule, NotificationsModule],
  providers: [ProductRequestsService],
  controllers: [ProductRequestsController],
})
export class ProductRequestsModule {}