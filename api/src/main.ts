import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { join } from 'path';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.use(helmet());

  // Orígenes permitidos para llamar a la API: la web pública y el admin.
  // Sin esto, cualquier sitio podría hacer requests con las credenciales
  // del usuario logueado (CORS abierto con credentials:true).
  //
  // Cada URL se agrega junto con su variante con/sin "www", porque el
  // navegador manda el Origin exacto (ej: www.tiendananook.store) y
  // alcanza con configurar una sola forma en las env vars.
  const withWwwVariant = (url: string): string[] => {
    try {
      const parsed = new URL(url);
      const altHost = parsed.hostname.startsWith('www.')
        ? parsed.hostname.slice(4)
        : `www.${parsed.hostname}`;
      return [url, `${parsed.protocol}//${altHost}`];
    } catch {
      return [url];
    }
  };
  const allowedOrigins = [process.env.FRONTEND_URL, process.env.ADMIN_URL]
    .filter((origin): origin is string => !!origin)
    .flatMap(withWwwVariant);
  app.enableCors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : true,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  // Sirve los archivos subidos (fotos de producto) como estáticos en
  // /uploads/*, fuera del prefijo /api — coincide con las URLs que arma
  // LocalDiskStorageProvider.
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads/' });

  app.setGlobalPrefix('api');
  app.enableShutdownHooks();

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`API lista en http://localhost:${port}/api`);
}
bootstrap();
