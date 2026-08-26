import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { BrandsService } from './brands.service';

@Controller('brands')
export class BrandsController {
  constructor(private svc: BrandsService) {}

  @Get()
  async all(@Query('categoryId') categoryId?: string) {
    return this.svc.getAll(categoryId);
  }

  @Post()
  async add(@Body('name') name: string, @Body('categoryId') categoryId?: string) {
    return this.svc.add(name, categoryId);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}
