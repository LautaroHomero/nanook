import {
  Controller,
  ForbiddenException,
  Get,
  Logger,
  Param,
  Post,
  Body,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(private service: PaymentsService) {}

  // Solo existe para la pantalla de "pago simulado" (checkout/mock-pago),
  // que reemplaza el checkout real de MP mientras MP_MOCK=true. Si ya hay
  // credenciales reales configuradas (MP_MOCK=false), este endpoint queda
  // deshabilitado: la confirmación real de pago pasa únicamente por el
  // webhook firmado o por /payments/resolve (que valida contra la API de MP).
  @Post('mock-confirm/:externalReference')
  async mockConfirm(@Param('externalReference') externalReference: string) {
    if (!this.service.isMockMode()) {
      throw new ForbiddenException('El pago simulado está deshabilitado en este entorno');
    }
    return this.service.confirmMockPayment(externalReference);
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
