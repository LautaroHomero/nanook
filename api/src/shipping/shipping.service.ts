import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  ARGENTINA_PROVINCES,
  DEFAULT_SHIPPING_COST_DOMICILIO,
  DEFAULT_SHIPPING_COST_SUCURSAL,
  DEFAULT_SHIPPING_DAYS,
} from './argentina-provinces';

export type ShippingMethod = 'SUCURSAL' | 'DOMICILIO';

export interface ShippingQuoteResult {
  estimatedDays: number;
  sucursal: number;
  domicilio: number;
}

@Injectable()
export class ShippingService {
  private readonly logger = new Logger(ShippingService.name);

  constructor(private prisma: PrismaService) {}

  async quote(province: string): Promise<ShippingQuoteResult> {
    const rate = await this.prisma.shippingRate.findUnique({ where: { province } });

    if (!rate) {
      this.logger.warn(`Sin tarifa cargada para "${province}", uso el costo por defecto`);
      return {
        estimatedDays: DEFAULT_SHIPPING_DAYS,
        sucursal: DEFAULT_SHIPPING_COST_SUCURSAL,
        domicilio: DEFAULT_SHIPPING_COST_DOMICILIO,
      };
    }

    return {
      estimatedDays: rate.estimatedDays,
      sucursal: Number(rate.costSucursal),
      domicilio: Number(rate.costDomicilio),
    };
  }

  async costForMethod(province: string, method: ShippingMethod) {
    const quote = await this.quote(province);
    return method === 'SUCURSAL' ? quote.sucursal : quote.domicilio;
  }

  // Admin: tabla completa de tarifas (incluye provincias sin cargar aún,
  // con el costo por defecto, para que se vean todas en el panel).
  async listRatesForAdmin() {
    const rates = await this.prisma.shippingRate.findMany();
    const byProvince = new Map(rates.map((r) => [r.province, r]));

    return ARGENTINA_PROVINCES.map((province) => {
      const rate = byProvince.get(province);
      return {
        province,
        costSucursal: rate ? Number(rate.costSucursal) : DEFAULT_SHIPPING_COST_SUCURSAL,
        costDomicilio: rate ? Number(rate.costDomicilio) : DEFAULT_SHIPPING_COST_DOMICILIO,
        estimatedDays: rate ? rate.estimatedDays : DEFAULT_SHIPPING_DAYS,
        configured: !!rate,
      };
    });
  }

  async setRate(
    province: string,
    costSucursal: number,
    costDomicilio: number,
    estimatedDays?: number,
  ) {
    return this.prisma.shippingRate.upsert({
      where: { province },
      create: {
        province,
        costSucursal,
        costDomicilio,
        estimatedDays: estimatedDays ?? DEFAULT_SHIPPING_DAYS,
      },
      update: { costSucursal, costDomicilio, ...(estimatedDays ? { estimatedDays } : {}) },
    });
  }
}
