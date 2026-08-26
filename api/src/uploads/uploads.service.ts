import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ImageStorageProvider,
  LocalDiskStorageProvider,
  UploadedFileInput,
} from './image-storage.provider';

@Injectable()
export class UploadsService {
  private provider: ImageStorageProvider;

  constructor(config: ConfigService) {
    const publicBaseUrl = config.get<string>('API_PUBLIC_URL') || 'http://localhost:3001';
    // TODO: cuando quieras pasar a un storage externo (S3, Cloudinary),
    // instanciá esa implementación acá en vez de LocalDiskStorageProvider.
    this.provider = new LocalDiskStorageProvider(publicBaseUrl);
  }

  async saveMany(files: UploadedFileInput[]) {
    const results = await Promise.all(files.map((f) => this.provider.save(f)));
    return results.map((r) => r.url);
  }
}