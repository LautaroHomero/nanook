import { Controller, Get, Post, Delete, Body, Param } from '@nestjs/common';
import { CategoriesService } from './categories.service';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly svc: CategoriesService) {}

  @Get()
  async all() {
    return this.svc.getAll();
  }

  @Post()
  async add(@Body('name') name: string, @Body('parentId') parentId?: string) {
    return this.svc.add(name, parentId);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}
