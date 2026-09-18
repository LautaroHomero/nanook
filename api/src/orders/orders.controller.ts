import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateShipmentDto } from './dto/update-shipment.dto';
import { AttachTransferReceiptDto } from './dto/attach-transfer-receipt.dto';
import { UpdateBankDetailsDto } from './dto/update-bank-details.dto';
import { AdminAuthGuard } from '../admin-auth/admin-auth.guard';

@Controller('orders')
export class OrdersController {
  constructor(private service: OrdersService) {}

  @Post()
  create(@Body() dto: CreateOrderDto) {
    return this.service.create(dto);
  }

  // Admin: todas las órdenes con su pago, para el panel de compras.
  @UseGuards(AdminAuthGuard)
  @Get('admin/all')
  findAllForAdmin() {
    return this.service.findAllForAdmin();
  }

  // Público: datos de la cuenta BBVA para mostrar en la pantalla de
  // transferencia. Declarado antes de ":id" para que no lo capture ese
  // parámetro.
  @Get('bank-details')
  getBankDetails() {
    return this.service.getPublicBankDetails();
  }

  // Admin: mismos datos + si ya se configuraron desde el panel o siguen
  // usando el default de las variables de entorno.
  @UseGuards(AdminAuthGuard)
  @Get('bank-details/admin')
  getBankDetailsForAdmin() {
    return this.service.getBankDetailsForAdmin();
  }

  @UseGuards(AdminAuthGuard)
  @Post('bank-details/admin')
  updateBankDetails(@Body() dto: UpdateBankDetailsDto) {
    return this.service.updateBankDetails(dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  // Público: el comprador adjunta el comprobante de una transferencia recién
  // hecha (la URL sale de subir el archivo por /uploads/transfer-receipt).
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post(':id/transfer-receipt')
  attachTransferReceipt(@Param('id') id: string, @Body() dto: AttachTransferReceiptDto) {
    return this.service.attachTransferReceipt(id, dto.receiptUrl);
  }

  // Admin: confirma a mano que la transferencia se acreditó.
  @UseGuards(AdminAuthGuard)
  @Post(':id/confirm-transfer')
  confirmTransferPayment(@Param('id') id: string) {
    return this.service.confirmTransferPayment(id);
  }

  // Admin: cancela un pedido pendiente (transferencia que nunca llegó) y
  // devuelve el stock reservado.
  @UseGuards(AdminAuthGuard)
  @Post(':id/cancel')
  cancelOrder(@Param('id') id: string) {
    return this.service.cancelOrder(id);
  }

  // Admin: actualiza el estado del envío manual (pendiente/preparando/enviado/entregado),
  // el número de envío y los números de serie de lo que salió.
  @UseGuards(AdminAuthGuard)
  @Patch(':id/shipment')
  updateShipment(@Param('id') id: string, @Body() dto: UpdateShipmentDto) {
    return this.service.updateShipment(id, dto);
  }
}
