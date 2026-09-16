import { Module } from '@nestjs/common';
import { ReturnRequestsService } from './return-request.service';
import { ReturnRequestsController } from './return-request.controller';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { NotificationsModule } from '../notifications/notification.module';

@Module({
  imports: [AdminAuthModule, NotificationsModule],
  providers: [ReturnRequestsService],
  controllers: [ReturnRequestsController],
})
export class ReturnRequestsModule {}
