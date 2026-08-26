import { randomUUID } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { writeFile } from 'fs/promises';
import { join } from 'path';

export interface UploadedFileInput {
  buffer: Buffer;
  originalName: string;
}

export interface UploadResult {
  url: string;
}

export interface ImageStorageProvider {
  save(file: UploadedFileInput): Promise<UploadResult>;
}

// Ruta física donde se guardan los archivos. En Docker, este directorio está
// montado como volumen (uploads_data:/app/uploads), así que sobrevive a
// reconstrucciones de la imagen.
export const UPLOAD_DIR = join(process.cwd(), 'uploads');

// Implementación local (MVP): guarda el archivo en disco, dentro del
// contenedor. Si el día de mañana pasás a S3/Cloudinary, escribís otra clase
// que implemente ImageStorageProvider y la instanciás en uploads.service.ts
// en vez de esta — el resto de la app no se entera del cambio.
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