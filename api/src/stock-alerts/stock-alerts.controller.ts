import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { StockAlertsService } from './stock-alerts.service';
import { CreateStockAlertDto } from './dto/create-stock-alert.dto';
import { AdminAuthGuard } from '../admin-auth/admin-auth.guard';

@Controller('stock-alerts')
export class StockAlertsController {
  constructor(private service: StockAlertsService) {}

  // Público: alguien pide que le avisen cuando un producto sin stock lo tenga
  @Post()
  create(@Body() dto: CreateStockAlertDto) {
    return this.service.create(dto);
  }

  // Admin: todos los avisos de stock pedidos, para el panel
  @UseGuards(AdminAuthGuard)
  @Get('admin/all')
  findAllForAdmin() {
    return this.service.findAllForAdmin();
  }
}
