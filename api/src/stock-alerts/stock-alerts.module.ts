import { Module } from '@nestjs/common';
import { StockAlertsService } from './stock-alerts.service';
import { StockAlertsController } from './stock-alerts.controller';
import { NotificationsModule } from '../notifications/notification.module';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';

@Module({
  imports: [NotificationsModule, AdminAuthModule],
  providers: [StockAlertsService],
  controllers: [StockAlertsController],
  exports: [StockAlertsService],
})
export class StockAlertsModule {}
