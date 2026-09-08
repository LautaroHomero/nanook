import { Body, Controller, Get, Logger, Param, Post, Query, Req, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

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
  webhook(@Req() req: Request, @Body() body: any, @Query() query: Record<string, string>) {
    const dataId = query['data.id'] ?? body?.data?.id ?? body?.id ?? body?.payment_id;
    const xSignature = req.headers['x-signature'];
    const xRequestId = req.headers['x-request-id'];

    this.logger.log(
      `Webhook recibido: dataId=${dataId ?? 'n/a'} type=${body?.type ?? query.type ?? 'n/a'} action=${body?.action ?? 'n/a'}`,
    );

    const signatureResult = this.service.validateWebhookSignature({
      xSignature: Array.isArray(xSignature) ? xSignature[0] : xSignature,
      xRequestId: Array.isArray(xRequestId) ? xRequestId[0] : xRequestId,
      dataId: typeof dataId === 'string' ? dataId : dataId != null ? String(dataId) : null,
    });

    if (!signatureResult.valid) {
      this.logger.warn(`Webhook rechazado: ${signatureResult.reason}`);
      throw new UnauthorizedException(`Webhook inválido: ${signatureResult.reason}`);
    }

    const normalizedPayload = {
      ...body,
      action: body?.action ?? query.action,
      api_version: body?.api_version ?? query.api_version,
      type: body?.type ?? query.type,
      data: {
        ...(body?.data ?? {}),
        id: typeof dataId === 'string' ? dataId : dataId != null ? String(dataId) : undefined,
      },
    };

    return this.service.handleWebhook(normalizedPayload);
  }

  @Get('status/:paymentId')
  paymentStatus(@Param('paymentId') paymentId: string) {
    return this.service.getPaymentStatus(paymentId);
  }

  @Get('resolve')
  resolveReturn(
    @Query('paymentId') paymentId?: string,
    @Query('orderId') orderId?: string,
    @Query('preferenceId') preferenceId?: string,
    @Query('status') status?: string,
  ) {
    return this.service.resolveReturn({
      paymentId,
      orderId,
      preferenceId,
      mpStatus: status,
    });
  }
}
