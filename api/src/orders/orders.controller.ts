import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
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
}
