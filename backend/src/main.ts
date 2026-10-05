import './instrument';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import helmet from 'helmet';
import { getCorsOrigins } from './common/security-config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const logger = new Logger('BankHubBootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Detras del proxy de Railway: IP real del cliente (rate limiting) y esquema HTTPS
  app.set('trust proxy', 1);

  // Headers de seguridad HTTP (CSP, HSTS, X-Content-Type-Options, etc.)
  app.use(helmet());

  // Prefijo global para todas las rutas API
  app.setGlobalPrefix('api');

  // Habilitar CORS para permitir peticiones desde el frontend Next.js
  app.enableCors({
    origin: getCorsOrigins(),
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Validación global de DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  // Swagger solo fuera de produccion (o con ENABLE_SWAGGER=true)
  if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_SWAGGER === 'true') {
    // Configuración de Documentación OpenAPI / Swagger
    const config = new DocumentBuilder()
      .setTitle('BankHub Banking & ERP API')
      .setDescription(
        'Documentación oficial de los microservicios backend de BankHub desarrollados en NestJS (Auth, Users, RENIEC, KYC, Accounts, Transactions).',
      )
      .setVersion('1.0.0')
      .addBearerAuth()
      .addTag('Autenticación & Login Seguro (HU2 - SCRUM-14/15/16/17/18/19)')
      .addTag('Cierre de Sesión Seguro (HU3 - SCRUM-20/21/22/23/24/25)')
      .addTag('Recuperación Segura de Contraseña (HU4 - SCRUM-26/27/28/29/30/31/32/33)')
      .addTag('Users & Registro (HU1 - SCRUM-10/11/12/13)')
      .addTag('Identidad & RENIEC (HU1)')
      .addTag('Biometría & KYC (HU1)')
      .addTag('Cuentas Bancarias (Account-Service)')
      .addTag('Transacciones & Transferencias (Transaction-Service)')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);

  }

  const port = process.env.PORT || 4000;
  await app.listen(port, '0.0.0.0');

  logger.log(`=======================================================`);
  logger.log(`🚀 BankHub NestJS Backend escuchando en: http://localhost:${port}`);
  logger.log(`📚 Documentación Swagger interactiva:    http://localhost:${port}/api/docs`);
  logger.log(`=======================================================`);
}

bootstrap();
