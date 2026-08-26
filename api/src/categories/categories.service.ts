import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  // Return top-level categories with children and brands
  async getAll() {
    return this.prisma.category.findMany({
      where: { parentId: null },
      include: { children: { include: { children: true } }, brands: true },
      orderBy: { name: 'asc' },
    });
  }

  async add(name: string, parentId?: string) {
    const data: any = { name };
    if (parentId) data.parentId = parentId;
    const created = await this.prisma.category.create({ data });
    return created;
  }

  async remove(id: string) {
    // Unlink children
    await this.prisma.category.updateMany({ where: { parentId: id }, data: { parentId: null } });
    await this.prisma.category.delete({ where: { id } });
    return { ok: true };
  }
}
