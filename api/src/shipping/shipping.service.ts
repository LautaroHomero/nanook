import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  MockAndreaniProvider,
  ShippingCreateInput,
  ShippingProvider,
  ShippingQuoteInput,
} from './shipping.provider';

@Injectable()
export class ShippingService {
  private provider: ShippingProvider;

  constructor(private config: ConfigService) {
    // TODO: cuando ANDREANI_MOCK=false, instanciar el provider real acá
    // (misma interfaz ShippingProvider, no requiere tocar orders.service)
    this.provider = new MockAndreaniProvider();
  }

  quote(input: ShippingQuoteInput) {
    return this.provider.quote(input);
  }

  createShipment(input: ShippingCreateInput) {
    return this.provider.createShipment(input);
  }
}
