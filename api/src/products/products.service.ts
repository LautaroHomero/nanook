import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StockAlertsService } from '../stock-alerts/stock-alerts.service';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';

@Injectable()
export class ProductsService {
  constructor(
    private prisma: PrismaService,
    private stockAlerts: StockAlertsService,
  ) {}

  // Catálogo público: solo productos activos
  findAllActive() {
    return this.prisma.product.findMany({
      where: { active: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Listado completo para el admin (incluye inactivos)
  findAllForAdmin() {
    return this.prisma.product.findMany({ orderBy: { createdAt: 'desc' } });
  }

  // Búsqueda para admin con filtros opcionales: q (name contains), min/max price, inStock
  async findForAdminFiltered(filters: {
    q?: string;
    minPrice?: string;
    maxPrice?: string;
    inStock?: string;
    categoryId?: string;
    brandId?: string;
  }) {
    const where: any = {};

    if (filters.q) {
      where.name = { contains: filters.q, mode: 'insensitive' };
    }

    if (filters.minPrice || filters.maxPrice) {
      where.price = {};
      if (filters.minPrice) where.price.gte = Number(filters.minPrice);
      if (filters.maxPrice) where.price.lte = Number(filters.maxPrice);
    }

    if (filters.inStock !== undefined) {
      const val = String(filters.inStock).toLowerCase();
      if (val === 'true') where.stock = { gt: 0 };
      if (val === 'false') where.stock = { lte: 0 };
    }

    if (filters.categoryId) {
      where.categoryId = filters.categoryId;
    }

    if (filters.brandId) {
      where.brandId = filters.brandId;
    }

    return this.prisma.product.findMany({ where, orderBy: { createdAt: 'desc' } });
  }

  // Same as admin filtered search but only returns active products
  async findActiveFiltered(filters: {
    q?: string;
    minPrice?: string;
    maxPrice?: string;
    inStock?: string;
    categoryId?: string;
    brandId?: string;
  }) {
    const where: any = { active: true };

    if (filters.q) {
      where.name = { contains: filters.q, mode: 'insensitive' };
    }

    if (filters.minPrice || filters.maxPrice) {
      where.price = {};
      if (filters.minPrice) where.price.gte = Number(filters.minPrice);
      if (filters.maxPrice) where.price.lte = Number(filters.maxPrice);
    }

    if (filters.inStock !== undefined) {
      const val = String(filters.inStock).toLowerCase();
      if (val === 'true') where.stock = { gt: 0 };
      if (val === 'false') where.stock = { lte: 0 };
    }

    if (filters.categoryId) where.categoryId = filters.categoryId;
    if (filters.brandId) where.brandId = filters.brandId;

    return this.prisma.product.findMany({ where, orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('Producto no encontrado');
    return product;
  }

  create(dto: CreateProductDto) {
    const data = { ...dto, description: dto.description ?? '' };
    return this.prisma.product.create({ data });
  }

  async update(id: string, dto: UpdateProductDto) {
    const before = await this.findOne(id);
    const updated = await this.prisma.product.update({ where: { id }, data: dto });

    if (before.stock === 0 && dto.stock !== undefined && dto.stock > 0) {
      await this.stockAlerts.notifyStockRestocked(id);
    }

    return updated;
  }

  async remove(id: string) {
    await this.findOne(id);
    // Baja lógica en vez de borrado físico, para no romper órdenes existentes
    return this.prisma.product.update({
      where: { id },
      data: { active: false },
    });
  }

  async hayStock(id: string) {
    const product = await this.findOne(id);
    return product.stock > 0;
  }

  // Ingreso de stock nuevo: un número de serie por cada unidad que entra,
  // para poder rastrear después con qué envío salió cada una.
  async addStock(id: string, serialNumbers: string[]) {
    const product = await this.findOne(id);

    const trimmed = serialNumbers.map((s) => s.trim()).filter(Boolean);
    if (trimmed.length === 0) {
      throw new BadRequestException('Cargá al menos un número de serie');
    }

    const existing = await this.prisma.productSerial.findMany({
      where: { serialNumber: { in: trimmed } },
      select: { serialNumber: true },
    });
    if (existing.length > 0) {
      throw new BadRequestException(
        `Ya existen números de serie cargados: ${existing.map((e) => e.serialNumber).join(', ')}`,
      );
    }

    const [, updated] = await this.prisma.$transaction([
      this.prisma.productSerial.createMany({
        data: trimmed.map((serialNumber) => ({ productId: id, serialNumber })),
      }),
      this.prisma.product.update({
        where: { id },
        data: { stock: { increment: trimmed.length } },
      }),
    ]);

    if (product.stock === 0 && updated.stock > 0) {
      await this.stockAlerts.notifyStockRestocked(id);
    }

    return updated;
  }

  listSerials(productId: string) {
    return this.prisma.productSerial.findMany({
      where: { productId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
