import { Controller, Get } from '@nestjs/common';

// Usado por Render (y por quien quiera confirmar que la API está viva) como
// health check — no debe depender de la base de datos ni de nada externo.
@Controller()
export class AppController {
  @Get()
  health() {
    return { status: 'ok' };
  }
}
