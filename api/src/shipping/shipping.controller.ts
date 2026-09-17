import { BadRequestException, Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ShippingZone } from '@prisma/client';
import { ShippingService } from './shipping.service';
import { QuoteShippingDto } from './dto/quote.dto';
import { SetShippingRateDto } from './dto/set-rate.dto';
import { AdminAuthGuard } from '../admin-auth/admin-auth.guard';

@Controller('shipping')
export class ShippingController {
  constructor(private service: ShippingService) {}

  @Post('quote')
  quote(@Body() dto: QuoteShippingDto) {
    return this.service.quote(dto.province, dto.partido, dto.itemsTotal);
  }

  @UseGuards(AdminAuthGuard)
  @Get('rates/admin')
  listRates() {
    return this.service.listRatesForAdmin();
  }

  @UseGuards(AdminAuthGuard)
  @Post('rates/admin/:zone')
  setRate(@Param('zone') zone: string, @Body() dto: SetShippingRateDto) {
    if (!Object.values(ShippingZone).includes(zone as ShippingZone)) {
      throw new BadRequestException(`Zona de envío inválida: "${zone}"`);
    }
    return this.service.setRate(
      zone as ShippingZone,
      dto.costSucursal,
      dto.costDomicilio,
      dto.estimatedDays,
    );
  }
}
