import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const logger = new Logger('BankHubBootstrap');
  const app = await NestFactory.create(AppModule);

  // Prefijo global para todas las rutas API
  app.setGlobalPrefix('api');

  // Habilitar CORS para permitir peticiones desde el frontend Next.js
  app.enableCors({
    origin: [
      'http://localhost:3000',
      'http://localhost:3002',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3002',
    ],
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

  // Configuración de Documentación OpenAPI / Swagger
  const config = new DocumentBuilder()
    .setTitle('BankHub Banking & ERP API')
    .setDescription(
      'Documentación oficial de los microservicios backend de BankHub desarrollados en NestJS (Auth, Users, RENIEC, KYC, Accounts, Transactions).',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .addTag('Autenticación & Sesión (HU2 - SCRUM-15/16/17/18)')
    .addTag('Users & Registro (HU1)')
    .addTag('Identidad & RENIEC (HU1)')
    .addTag('Biometría & KYC (HU1)')
    .addTag('Cuentas Bancarias (Account-Service)')
    .addTag('Transacciones & Transferencias (Transaction-Service)')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 4000;
  await app.listen(port);

  logger.log(`=======================================================`);
  logger.log(`🚀 BankHub NestJS Backend escuchando en: http://localhost:${port}`);
  logger.log(`📚 Documentación Swagger interactiva:    http://localhost:${port}/api/docs`);
  logger.log(`=======================================================`);
}

bootstrap();
