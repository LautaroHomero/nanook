import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ProductRequestsService } from './product-request.service';
import { CreateProductRequestDto } from './dto/create-product-request.dto';
import { AdminAuthGuard } from '../admin-auth/admin-auth.guard';

@Controller('product-requests')
export class ProductRequestsController {
  constructor(private service: ProductRequestsService) {}

  // Público: alguien pide un producto que no está en el catálogo
  @Post()
  create(@Body() dto: CreateProductRequestDto) {
    return this.service.create(dto);
  }

  @UseGuards(AdminAuthGuard)
  @Get('admin/all')
  findAllForAdmin(@Query('status') status?: string) {
    return this.service.findAllForAdmin(status);
  }

  @UseGuards(AdminAuthGuard)
  @Patch(':id/dismiss')
  dismiss(@Param('id') id: string) {
    return this.service.dismiss(id);
  }

  @UseGuards(AdminAuthGuard)
  @Post(':id/link/:productId')
  link(@Param('id') id: string, @Param('productId') productId: string) {
    return this.service.linkToProduct(id, productId);
  }
}