import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CloudinaryStorageProvider,
  ImageStorageProvider,
  LocalDiskStorageProvider,
  UploadedFileInput,
} from './image-storage.provider';

@Injectable()
export class UploadsService {
  private provider: ImageStorageProvider;

  constructor(config: ConfigService) {
    const cloudName = config.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = config.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = config.get<string>('CLOUDINARY_API_SECRET');

    if (cloudName && apiKey && apiSecret) {
      this.provider = new CloudinaryStorageProvider({ cloudName, apiKey, apiSecret });
    } else {
      // Sin credenciales de Cloudinary (típico en desarrollo local): guarda
      // en el disco del contenedor. En producción (Render, sin disco
      // persistente en el plan free) esto se pierde en cada deploy, por eso
      // ahí sí hacen falta las tres variables de Cloudinary.
      const publicBaseUrl = config.get<string>('API_PUBLIC_URL') || 'http://localhost:3001';
      this.provider = new LocalDiskStorageProvider(publicBaseUrl);
    }
  }

  async saveMany(files: UploadedFileInput[]) {
    const results = await Promise.all(files.map((f) => this.provider.save(f)));
    return results.map((r) => r.url);
  }
}