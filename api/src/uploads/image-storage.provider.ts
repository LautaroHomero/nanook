import { randomUUID } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { v2 as cloudinary } from 'cloudinary';

export interface UploadedFileInput {
  buffer: Buffer;
  originalName: string;
}

export interface UploadResult {
  url: string;
}

export interface ImageStorageProvider {
  save(file: UploadedFileInput, folder?: string): Promise<UploadResult>;
}

// Ruta física donde se guardan los archivos. En Docker, este directorio está
// montado como volumen (uploads_data:/app/uploads), así que sobrevive a
// reconstrucciones de la imagen.
export const UPLOAD_DIR = join(process.cwd(), 'uploads');

// Guarda el archivo en disco, dentro del contenedor. Se usa en desarrollo
// local (con el volumen de docker-compose) o como fallback si no hay
// credenciales de Cloudinary configuradas — ver CloudinaryStorageProvider,
// que es lo que corre en producción.
export class LocalDiskStorageProvider implements ImageStorageProvider {
  constructor(private publicBaseUrl: string) {
    if (!existsSync(UPLOAD_DIR)) {
      mkdirSync(UPLOAD_DIR, { recursive: true });
    }
  }

  async save(file: UploadedFileInput): Promise<UploadResult> {
    const ext = file.originalName.split('.').pop() || 'jpg';
    const filename = `${randomUUID()}.${ext}`;
    await writeFile(join(UPLOAD_DIR, filename), file.buffer);
    return { url: `${this.publicBaseUrl}/uploads/${filename}` };
  }
}

export const DEFAULT_CLOUDINARY_FOLDER = 'nanook/products';

// Sube el archivo a Cloudinary en vez de al disco del contenedor: en Render
// (sin disco persistente en el plan free) el disco local se borra en cada
// deploy, así que las fotos de producto necesitan vivir en un storage externo.
export class CloudinaryStorageProvider implements ImageStorageProvider {
  constructor(credentials: { cloudName: string; apiKey: string; apiSecret: string }) {
    cloudinary.config({
      secure: true,
      cloud_name: credentials.cloudName,
      api_key: credentials.apiKey,
      api_secret: credentials.apiSecret,
    });
  }

  async save(file: UploadedFileInput, folder: string = DEFAULT_CLOUDINARY_FOLDER): Promise<UploadResult> {
    const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder, resource_type: 'image' },
        (error, uploadResult) => {
          if (error || !uploadResult) {
            reject(error || new Error('Cloudinary no devolvió resultado'));
            return;
          }
          resolve(uploadResult);
        },
      );
      stream.end(file.buffer);
    });

    return { url: result.secure_url };
  }
}