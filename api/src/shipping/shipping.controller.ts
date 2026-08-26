import { Body, Controller, Post } from '@nestjs/common';
import { ShippingService } from './shipping.service';
import { QuoteShippingDto } from './dto/quote.dto';

@Controller('shipping')
export class ShippingController {
  constructor(private service: ShippingService) {}

  @Post('quote')
  quote(@Body() dto: QuoteShippingDto) {
    return this.service.quote(dto);
  }
}
