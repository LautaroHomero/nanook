import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ReturnRequestsService } from './return-request.service';
import { CreateReturnRequestDto } from './dto/create-return-request.dto';
import { UpdateReturnRequestDto } from './dto/update-return-request.dto';
import { AdminAuthGuard } from '../admin-auth/admin-auth.guard';

@Controller('return-requests')
export class ReturnRequestsController {
  constructor(private service: ReturnRequestsService) {}

  // Público: el comprador pide la devolución de una orden propia.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post()
  create(@Body() dto: CreateReturnRequestDto) {
    return this.service.create(dto);
  }

  @UseGuards(AdminAuthGuard)
  @Get('admin/all')
  findAllForAdmin(@Query('status') status?: string) {
    return this.service.findAllForAdmin(status);
  }

  @UseGuards(AdminAuthGuard)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateReturnRequestDto) {
    return this.service.updateStatus(id, dto.status, dto.adminNote);
  }
}
