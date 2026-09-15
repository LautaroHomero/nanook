import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ShippingService } from './shipping.service';
import { QuoteShippingDto } from './dto/quote.dto';
import { SetShippingRateDto } from './dto/set-rate.dto';
import { AdminAuthGuard } from '../admin-auth/admin-auth.guard';

@Controller('shipping')
export class ShippingController {
  constructor(private service: ShippingService) {}

  @Post('quote')
  quote(@Body() dto: QuoteShippingDto) {
    return this.service.quote(dto.province);
  }

  @UseGuards(AdminAuthGuard)
  @Get('rates/admin')
  listRates() {
    return this.service.listRatesForAdmin();
  }

  @UseGuards(AdminAuthGuard)
  @Post('rates/admin/:province')
  setRate(@Param('province') province: string, @Body() dto: SetShippingRateDto) {
    return this.service.setRate(
      decodeURIComponent(province),
      dto.costSucursal,
      dto.costDomicilio,
      dto.estimatedDays,
    );
  }
}
