import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const PASSWORD = 'ClaveSegura123!';
const SUPER_ROLE = 1; // Rol ADMIN con todos los permisos

describe('Sprint 3 - HU17, HU18 y HU19 Backend (PostgreSQL real)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const http = () => request(app.getHttpServer());

  interface Actor {
    id: string;
    email: string;
    token: string;
  }

  let seq = 0;
  const uniq = () => `${Date.now()}${++seq}`.slice(-8);
  const auth = (a: Actor) => ({ Authorization: `Bearer ${a.token}` });

  async function login(email: string, password = PASSWORD): Promise<string> {
    const res = await http().post('/api/auth/login').send({ email, password });
    expect(res.status).toBe(200);
    return res.body.accessToken;
  }

  async function makeAdmin(): Promise<Actor> {
    const email = `adm${uniq()}@test.local`;
    const a = await prisma.admin.create({
      data: { nombre_usuario: `Admin ${uniq()}`, correo: email, password_hash: bcrypt.hashSync(PASSWORD, 4) },
    });
    await prisma.admin_rol.create({ data: { id_admin: a.id, id_rol: SUPER_ROLE } });
    return { id: a.id, email, token: await login(email) };
  }

  async function makeClient(overrides: Partial<any> = {}): Promise<Actor & { dni: string }> {
    const n = uniq();
    const email = `cli${n}@test.local`;
    const c = await prisma.cliente.create({
      data: {
        dni: n,
        nombres: `Cliente ${n}`,
        apellidos: 'Prueba',
        correo: email,
        telefono: '987654321',
        password_hash: bcrypt.hashSync(PASSWORD, 4),
        estado: 'ACTIVO',
        rol: 'CLIENTE',
        ...overrides,
      },
    });
    const token = c.estado === 'ACTIVO' ? await login(email) : '';
    return { id: c.id, email, dni: c.dni, token };
  }

  async function createAccount(clienteId: string, balance = 100): Promise<{ id: string; cci: string }> {
    const tipo = await prisma.tipo_cuenta.findFirst();
    const cci = `191-${uniq()}-00`;
    const cuenta = await prisma.cuenta.create({
      data: {
        id_cliente: clienteId,
        id_tipo_cuenta: tipo!.id,
        moneda: 'PEN',
        cci,
        saldo: balance,
        estado_cuenta: 'ACTIVA',
      },
    });
    return { id: cuenta.id, cci: cuenta.cci };
  }

  beforeAll(async () => {
    const fixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = fixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.setGlobalPrefix('api');
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('HU17 - Gestión de clientes por administrador', () => {
    it('SCRUM-71: Administrador puede buscar y paginar clientes con filtros (q, status)', async () => {
      const admin = await makeAdmin();
      const clientA = await makeClient({ nombres: 'Alberto Busqueda' });
      const clientB = await makeClient({ nombres: 'Beto Inactivo', estado: 'INACTIVO' });

      // Busqueda por texto 'Alberto'
      const resQ = await http().get('/api/users?q=Alberto&page=1&pageSize=10').set(auth(admin));
      expect(resQ.status).toBe(200);
      expect(resQ.body.items).toBeDefined();
      expect(resQ.body.total).toBeGreaterThanOrEqual(1);
      expect(resQ.body.items.some((c: any) => c.name.includes('Alberto'))).toBe(true);

      // Filtro por estado 'inactive'
      const resInactive = await http().get('/api/users?status=inactive&page=1&pageSize=10').set(auth(admin));
      expect(resInactive.status).toBe(200);
      expect(resInactive.body.items.every((c: any) => c.status === 'inactive')).toBe(true);
    });

    it('SCRUM-71: Obtener detalle de cliente con sus cuentas asociadas', async () => {
      const admin = await makeAdmin();
      const client = await makeClient();
      const acc = await createAccount(client.id, 250);

      const res = await http().get(`/api/users/${client.id}`).set(auth(admin));
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(client.id);
      expect(res.body.email).toBe(client.email);
      expect(res.body.accounts).toBeDefined();
      expect(res.body.accounts.length).toBeGreaterThanOrEqual(1);
      expect(res.body.accounts[0].cci).toBe(acc.cci);
    });

    it('SCRUM-72 & 73 & 75: Actualizar datos de cliente, proteger campos sensibles y registrar auditoría', async () => {
      const admin = await makeAdmin();
      const client = await makeClient({ nombres: 'Original Name' });
      const newEmail = `updated${uniq()}@test.local`;

      const res = await http()
        .patch(`/api/users/${client.id}`)
        .set(auth(admin))
        .send({
          name: 'Nombre Modificado',
          email: newEmail,
          phone: '999888777',
          reason: 'Corrección solicitada por el titular',
          dni: '00000000', // Campo sensible que no debe modificarse
        });

      expect(res.status).toBe(200);
      expect(res.body.name).toContain('Nombre Modificado');
      expect(res.body.email).toBe(newEmail);
      expect(res.body.dni).toBe(client.dni); // DNI se preserva intacto

      // Verificar que se registró la auditoría en auditoria_admin
      const audit = await prisma.auditoria_admin.findFirst({
        where: { accion: 'CLIENTE_ACTUALIZAR', objeto_id: client.id },
        orderBy: { fecha: 'desc' },
      });
      expect(audit).toBeDefined();
      expect(audit?.id_actor).toBe(admin.id);
      expect(audit?.resultado).toBe('EXITO');
    });

    it('SCRUM-91: Recargar saldo de una cuenta bancaria (simulación de depósito cajero) con movimiento contable', async () => {
      const admin = await makeAdmin();
      const client = await makeClient();
      const acc = await createAccount(client.id, 100);

      const res = await http()
        .post(`/api/accounts/${acc.id}/recharge`)
        .set(auth(admin))
        .set('Idempotency-Key', `recharge-${uniq()}`)
        .send({
          amount: 50.5,
          description: 'Depósito en efectivo en cajero',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.numericBalance).toBe(150.5);

      // Verificar que se registró el movimiento contable tipo CREDITO
      const mov = await prisma.movimiento.findUnique({
        where: { id: res.body.movementId },
      });
      expect(mov).toBeDefined();
      expect(mov?.tipo).toBe('CREDITO');
      expect(mov?.categoria).toBe('Recarga');
      expect(Number(mov?.monto)).toBe(50.5);
    });
  });

  describe('HU19 - Control del estado del usuario (Bloqueo / Desbloqueo / Concurrencia)', () => {
    it('SCRUM-84, 87, 88: Bloquear usuario cliente revoca inmediatamente sus sesiones y audita', async () => {
      const admin = await makeAdmin();
      const client = await makeClient();

      // Cliente tiene sesión activa y puede acceder
      const meBefore = await http().get('/api/users/me').set(auth(client));
      expect(meBefore.status).toBe(200);

      // Administrador bloquea al cliente
      const resBlock = await http()
        .post(`/api/users/${client.id}/block`)
        .set(auth(admin))
        .send({ reason: 'Reporte de actividad sospechosa' });

      expect(resBlock.status).toBe(201);
      expect(resBlock.body.success).toBe(true);
      expect(resBlock.body.status).toBe('inactive');

      // Reintentar bloquear al mismo usuario responde conflicto 409
      const resConflict = await http()
        .post(`/api/users/${client.id}/block`)
        .set(auth(admin))
        .send({ reason: 'Doble bloqueo' });
      expect(resConflict.status).toBe(409);

      // El token del cliente ahora es rechazado inmediatamente (401)
      const meAfter = await http().get('/api/users/me').set(auth(client));
      expect(meAfter.status).toBe(401);

      // Cliente bloqueado tampoco puede volver a iniciar sesión
      const loginAttempt = await http()
        .post('/api/auth/login')
        .send({ email: client.email, password: PASSWORD });
      expect(loginAttempt.status).toBe(401);

      // Verificar auditoría de bloqueo
      const audit = await prisma.auditoria_admin.findFirst({
        where: { accion: 'CLIENTE_BLOQUEAR', objeto_id: client.id },
      });
      expect(audit).toBeDefined();
      expect(audit?.resultado).toBe('EXITO');
    });

    it('SCRUM-85, 87, 88: Desbloquear usuario cliente rehabilita su acceso y limpia bloqueos', async () => {
      const admin = await makeAdmin();
      const client = await makeClient({ estado: 'INACTIVO' });

      // Desbloquear al cliente
      const resUnblock = await http()
        .post(`/api/users/${client.id}/unblock`)
        .set(auth(admin))
        .send({ reason: 'Validación de identidad superada' });

      expect(resUnblock.status).toBe(201);
      expect(resUnblock.body.success).toBe(true);
      expect(resUnblock.body.status).toBe('active');

      // Reintentar desbloquear responde 409
      const resConflict = await http()
        .post(`/api/users/${client.id}/unblock`)
        .set(auth(admin))
        .send({ reason: 'Doble desbloqueo' });
      expect(resConflict.status).toBe(409);

      // Usuario ahora puede loguearse de nuevo
      const loginAgain = await http()
        .post('/api/auth/login')
        .send({ email: client.email, password: PASSWORD });
      expect(loginAgain.status).toBe(200);

      // Verificar auditoría de desbloqueo
      const audit = await prisma.auditoria_admin.findFirst({
        where: { accion: 'CLIENTE_DESBLOQUEAR', objeto_id: client.id },
      });
      expect(audit).toBeDefined();
      expect(audit?.resultado).toBe('EXITO');
    });
  });

  describe('HU18 - Consultar operaciones realizadas', () => {
    it('SCRUM-78 & 79: Consulta de operaciones con filtros validados y paginación', async () => {
      const admin = await makeAdmin();
      const client = await makeClient({ nombres: 'Operador Test' });
      const acc = await createAccount(client.id, 500);

      // Generar 2 recargas registradas
      await http()
        .post(`/api/accounts/${acc.id}/recharge`)
        .set(auth(admin))
        .send({ amount: 120, description: 'Operación Ahorro' });

      await http()
        .post(`/api/accounts/${acc.id}/recharge`)
        .set(auth(admin))
        .send({ amount: 80, description: 'Operación Corriente' });

      // Consultar operaciones como admin
      const res = await http()
        .get(`/api/admin/operations?q=Operador&page=1&pageSize=10`)
        .set(auth(admin));

      expect(res.status).toBe(200);
      expect(res.body.items).toBeDefined();
      expect(res.body.total).toBeGreaterThanOrEqual(2);
      expect(res.body.items[0]).toHaveProperty('accountCci');
      expect(res.body.items[0]).toHaveProperty('clientName');
      expect(res.body.items[0]).toHaveProperty('amount');
      expect(res.body.items[0]).toHaveProperty('type');

      // Filtrar por monto
      const resFilter = await http()
        .get(`/api/admin/operations?minAmount=100&page=1&pageSize=10`)
        .set(auth(admin));
      expect(resFilter.status).toBe(200);
      expect(resFilter.body.items.every((op: any) => op.numericAmount >= 100)).toBe(true);

      // Cliente ordinario no tiene permiso de supervisar operaciones (403)
      const resForbidden = await http()
        .get('/api/admin/operations')
        .set(auth(client));
      expect(resForbidden.status).toBe(403);
    });
  });
});
