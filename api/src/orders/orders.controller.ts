import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateShipmentDto } from './dto/update-shipment.dto';
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

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  // Admin: actualiza el estado del envío manual (pendiente/preparando/enviado/entregado),
  // el número de envío y los números de serie de lo que salió.
  @UseGuards(AdminAuthGuard)
  @Patch(':id/shipment')
  updateShipment(@Param('id') id: string, @Body() dto: UpdateShipmentDto) {
    return this.service.updateShipment(id, dto);
  }
}
