import { Injectable, Logger } from '@nestjs/common';
import { ShippingZone } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  DEFAULT_SHIPPING_COST_DOMICILIO,
  DEFAULT_SHIPPING_COST_SUCURSAL,
  DEFAULT_SHIPPING_DAYS,
  FREE_SHIPPING_THRESHOLD,
  SHIPPING_ZONES,
  SHIPPING_ZONE_LABEL,
  resolveShippingZone,
} from './shipping-zones';

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

  async quote(province: string, partido?: string | null, itemsTotal = 0): Promise<ShippingQuoteResult> {
    const zone = resolveShippingZone(province, partido);
    const rate = await this.prisma.shippingZoneRate.findUnique({ where: { zone } });

    const base = rate
      ? {
          estimatedDays: rate.estimatedDays,
          sucursal: Number(rate.costSucursal),
          domicilio: Number(rate.costDomicilio),
        }
      : {
          estimatedDays: DEFAULT_SHIPPING_DAYS,
          sucursal: DEFAULT_SHIPPING_COST_SUCURSAL,
          domicilio: DEFAULT_SHIPPING_COST_DOMICILIO,
        };

    if (!rate) {
      this.logger.warn(`Sin tarifa cargada para la zona "${zone}", uso el costo por defecto`);
    }

    if (itemsTotal > FREE_SHIPPING_THRESHOLD) {
      return { ...base, sucursal: 0, domicilio: 0 };
    }

    return base;
  }

  async costForMethod(
    province: string,
    method: ShippingMethod,
    partido?: string | null,
    itemsTotal = 0,
  ) {
    const quote = await this.quote(province, partido, itemsTotal);
    return method === 'SUCURSAL' ? quote.sucursal : quote.domicilio;
  }

  // Admin: tabla completa de tarifas (incluye zonas sin cargar aún, con
  // el costo por defecto, para que se vean todas en el panel).
  async listRatesForAdmin() {
    const rates = await this.prisma.shippingZoneRate.findMany();
    const byZone = new Map(rates.map((r) => [r.zone, r]));

    return SHIPPING_ZONES.map((zone) => {
      const rate = byZone.get(zone);
      return {
        zone,
        label: SHIPPING_ZONE_LABEL[zone],
        costSucursal: rate ? Number(rate.costSucursal) : DEFAULT_SHIPPING_COST_SUCURSAL,
        costDomicilio: rate ? Number(rate.costDomicilio) : DEFAULT_SHIPPING_COST_DOMICILIO,
        estimatedDays: rate ? rate.estimatedDays : DEFAULT_SHIPPING_DAYS,
        configured: !!rate,
      };
    });
  }

  async setRate(
    zone: ShippingZone,
    costSucursal: number,
    costDomicilio: number,
    estimatedDays?: number,
  ) {
    return this.prisma.shippingZoneRate.upsert({
      where: { zone },
      create: {
        zone,
        costSucursal,
        costDomicilio,
        estimatedDays: estimatedDays ?? DEFAULT_SHIPPING_DAYS,
      },
      update: { costSucursal, costDomicilio, ...(estimatedDays ? { estimatedDays } : {}) },
    });
  }
}
