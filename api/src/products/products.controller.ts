import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';
import { AdminAuthGuard } from '../admin-auth/admin-auth.guard';

@Controller('products')
export class ProductsController {
  constructor(private service: ProductsService) {}

  // Público: catálogo para la web de compra
  @Get()
  findAllActive() {
    return this.service.findAllActive();
  }

  // Public search for web customers (only active products)
  @Get('search')
  findActiveFiltered(
    @Query('q') q?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('inStock') inStock?: string,
  ) {
    return this.service.findActiveFiltered({ q, minPrice, maxPrice, inStock });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  // Admin: listado completo, incluye inactivos
  @UseGuards(AdminAuthGuard)
  @Get('admin/all')
  findAllForAdmin() {
    return this.service.findAllForAdmin();
  }

  @UseGuards(AdminAuthGuard)
  @Get('admin/search')
  findForAdminFiltered(
    @Query('q') q?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('inStock') inStock?: string,
    @Query('categoryId') categoryId?: string,
    @Query('brandId') brandId?: string,
  ) {
    return this.service.findForAdminFiltered({ q, minPrice, maxPrice, inStock, categoryId, brandId });
  }

  @UseGuards(AdminAuthGuard)
  @Post()
  create(@Body() dto: CreateProductDto) {
    return this.service.create(dto);
  }

  @UseGuards(AdminAuthGuard)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.service.update(id, dto);
  }

  @UseGuards(AdminAuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
