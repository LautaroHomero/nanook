import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AdminAuthService {
  constructor(
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async login(dto: LoginDto) {
    const adminEmail = this.config.get<string>('ADMIN_EMAIL');
    const adminPasswordHash = this.config.get<string>('ADMIN_PASSWORD_HASH');

    if (!adminEmail || !adminPasswordHash) {
      throw new Error('Falta configurar ADMIN_EMAIL / ADMIN_PASSWORD_HASH');
    }

    const passwordMatches = await bcrypt.compare(dto.password, adminPasswordHash);

    if (dto.email !== adminEmail || !passwordMatches) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const token = await this.jwt.signAsync({ sub: 'admin', email: dto.email });
    return { accessToken: token };
  }
}
