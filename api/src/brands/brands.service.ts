import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BrandsService {
  constructor(private prisma: PrismaService) {}

  async getAll(categoryId?: string) {
    const where: any = {};
    if (categoryId) where.categoryId = categoryId;
    return this.prisma.brand.findMany({ where, orderBy: { name: 'asc' } });
  }

  async add(name: string, categoryId?: string) {
    const data: any = { name };
    if (categoryId) data.categoryId = categoryId;
    return this.prisma.brand.create({ data });
  }

  async remove(id: string) {
    await this.prisma.brand.delete({ where: { id } });
    return { ok: true };
  }
}
