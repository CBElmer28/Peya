"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
async function bootstrap() {
    const logger = new common_1.Logger('BankHubBootstrap');
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.setGlobalPrefix('api');
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
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: false,
    }));
    const config = new swagger_1.DocumentBuilder()
        .setTitle('BankHub Banking & ERP API')
        .setDescription('Documentación oficial de los microservicios backend de BankHub desarrollados en NestJS (Auth, Users, RENIEC, KYC, Accounts, Transactions).')
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
    const document = swagger_1.SwaggerModule.createDocument(app, config);
    swagger_1.SwaggerModule.setup('api/docs', app, document);
    const port = process.env.PORT || 4000;
    await app.listen(port);
    logger.log(`=======================================================`);
    logger.log(`🚀 BankHub NestJS Backend escuchando en: http://localhost:${port}`);
    logger.log(`📚 Documentación Swagger interactiva:    http://localhost:${port}/api/docs`);
    logger.log(`=======================================================`);
}
bootstrap();
//# sourceMappingURL=main.js.map