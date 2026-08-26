import {
  BadRequestException,
  Controller,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { AdminAuthGuard } from '../admin-auth/admin-auth.guard';
import { UploadsService } from './uploads.service';

@Controller('uploads')
export class UploadsController {
  constructor(private service: UploadsService) {}

  // Protegido: solo el admin sube imágenes. Acepta hasta 10 archivos en el
  // campo "files" de un multipart/form-data.
  @UseGuards(AdminAuthGuard)
  @Post()
  @UseInterceptors(FilesInterceptor('files', 10))
  async upload(@UploadedFiles() files: any[]) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No se recibió ningún archivo');
    }
    const urls = await this.service.saveMany(
      files.map((f) => ({ buffer: f.buffer, originalName: f.originalname })),
    );
    return { urls };
  }
}