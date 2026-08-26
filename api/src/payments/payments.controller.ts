import { Body, Controller, Param, Post } from '@nestjs/common';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private service: PaymentsService) {}

  @Post('confirm/:orderId')
  confirm(@Param('orderId') orderId: string) {
    return this.service.markAsPaid(orderId);
  }

  // MVP: confirma el pago manualmente (reemplaza al webhook real de MP,
  // que en producción llama acá solo tras validar la notificación).
  @Post('mock-confirm/:orderId')
  mockConfirm(@Param('orderId') orderId: string) {
    return this.service.markAsPaid(orderId);
  }

  @Post('webhook')
  webhook(@Body() payload: any) {
    const orderId =
      payload?.data?.external_reference ??
      payload?.external_reference ??
      payload?.data?.metadata?.orderId;

    if (!orderId) {
      return { received: true };
    }

    if (payload?.type === 'payment' && payload?.action === 'payment.updated') {
      return this.service.markAsPaid(orderId);
    }

    return { received: true, orderId };
  }
}
