import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AdminAuthService } from './admin-auth.service';
import { LoginDto } from './dto/login.dto';

@Controller('admin/auth')
export class AdminAuthController {
  constructor(private service: AdminAuthService) {}

  // Límite propio, más estricto que el global, para frenar fuerza bruta.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.service.login(dto);
  }
}
