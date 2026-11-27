import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const PASSWORD = 'ClaveSegura123!';
const SUPER_ROLE = 1; // todos los permisos
const AUDITOR_ROLE = 2; // METRICAS_VER, CUENTAS_SUPERVISAR, CLIENTES_VER (sin CLIENTES_GESTIONAR)

describe('Sprint 3 - Subtareas de seguridad (SCRUM-74, 80, 82, 86)', () => {
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

  async function login(email: string): Promise<string> {
    const res = await http().post('/api/auth/login').send({ email, password: PASSWORD });
    expect(res.status).toBe(200);
    return res.body.accessToken;
  }

  /** Administrador con los roles indicados (vacio = administrador sin ningun permiso). */
  async function makeAdmin(roles: number[]): Promise<Actor> {
    const email = `adm${uniq()}@test.local`;
    const a = await prisma.admin.create({
      data: { nombre_usuario: `Admin ${uniq()}`, correo: email, password_hash: bcrypt.hashSync(PASSWORD, 4) },
    });
    for (const id_rol of roles) await prisma.admin_rol.create({ data: { id_admin: a.id, id_rol } });
    return { id: a.id, email, token: await login(email) };
  }

  async function makeClient(): Promise<Actor & { dni: string }> {
    const n = uniq();
    const email = `cli${n}@test.local`;
    const c = await prisma.cliente.create({
      data: {
        dni: n,
        nombres: `Cliente ${n}`,
        apellidos: 'Seguridad',
        correo: email,
        telefono: '987654321',
        password_hash: bcrypt.hashSync(PASSWORD, 4),
        estado: 'ACTIVO',
        rol: 'CLIENTE',
      },
    });
    return { id: c.id, email, dni: c.dni, token: await login(email) };
  }

  async function createAccount(clienteId: string, balance = 100): Promise<{ id: string }> {
    const tipo = await prisma.tipo_cuenta.findFirst();
    const cuenta = await prisma.cuenta.create({
      data: {
        id_cliente: clienteId,
        id_tipo_cuenta: tipo!.id,
        moneda: 'PEN',
        cci: `191-${uniq()}-00`,
        saldo: balance,
        estado_cuenta: 'ACTIVA',
      },
    });
    return { id: cuenta.id };
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

  describe('SCRUM-74 - Restringir el acceso a la gestión de clientes', () => {
    it('sin token responde 401 en listar, detalle, editar, bloquear y eliminar', async () => {
      const client = await makeClient();
      expect((await http().get('/api/users')).status).toBe(401);
      expect((await http().get(`/api/users/${client.id}`)).status).toBe(401);
      expect((await http().patch(`/api/users/${client.id}`).send({ name: 'X' })).status).toBe(401);
      expect((await http().post(`/api/users/${client.id}/block`).send({})).status).toBe(401);
      expect((await http().delete(`/api/users/${client.id}`)).status).toBe(401);
    });

    it('un cliente corriente recibe 403 en todos los endpoints de gestión', async () => {
      const intruso = await makeClient();
      const victima = await makeClient();
      expect((await http().get('/api/users').set(auth(intruso))).status).toBe(403);
      expect((await http().get(`/api/users/${victima.id}`).set(auth(intruso))).status).toBe(403);
      expect((await http().patch(`/api/users/${victima.id}`).set(auth(intruso)).send({ name: 'X' })).status).toBe(403);
      expect((await http().post(`/api/users/${victima.id}/block`).set(auth(intruso)).send({})).status).toBe(403);
      expect((await http().delete(`/api/users/${victima.id}`).set(auth(intruso))).status).toBe(403);
    });

    it('un administrador solo con CLIENTES_VER puede consultar pero no gestionar (403) y queda auditado', async () => {
      const auditor = await makeAdmin([AUDITOR_ROLE]);
      const client = await makeClient();

      expect((await http().get(`/api/users/${client.id}`).set(auth(auditor))).status).toBe(200);

      const patch = await http().patch(`/api/users/${client.id}`).set(auth(auditor)).send({ name: 'Intento' });
      expect(patch.status).toBe(403);
      const block = await http().post(`/api/users/${client.id}/block`).set(auth(auditor)).send({});
      expect(block.status).toBe(403);

      // El cliente sigue intacto y activo
      const still = await prisma.cliente.findUnique({ where: { id: client.id } });
      expect(still?.estado).toBe('ACTIVO');
      expect(still?.nombres).not.toBe('Intento');

      const denied = await prisma.auditoria_admin.findFirst({
        where: { id_actor: auditor.id, accion: 'ACCESO_DENEGADO', resultado: 'DENEGADO' },
      });
      expect(denied).not.toBeNull();
    });

    it('un administrador no puede bloquearse ni eliminarse a sí mismo', async () => {
      const admin = await makeAdmin([SUPER_ROLE]);
      expect((await http().delete(`/api/users/${admin.id}`).set(auth(admin))).status).toBe(403);
      expect((await http().post(`/api/users/${admin.id}/block`).set(auth(admin)).send({})).status).toBe(403);
    });
  });

  describe('SCRUM-80 - Permisos en la consulta de operaciones', () => {
    it('sin token → 401; cliente → 403; administrador sin permisos → 403', async () => {
      const client = await makeClient();
      const sinPermisos = await makeAdmin([]);

      expect((await http().get('/api/admin/operations')).status).toBe(401);
      expect((await http().get('/api/admin/operations').set(auth(client))).status).toBe(403);
      expect((await http().get('/api/admin/operations').set(auth(sinPermisos))).status).toBe(403);
    });

    it('administrador con CUENTAS_SUPERVISAR → 200 y la consulta queda auditada', async () => {
      const auditor = await makeAdmin([AUDITOR_ROLE]);
      const res = await http().get('/api/admin/operations?page=1&pageSize=5').set(auth(auditor));
      expect(res.status).toBe(200);

      // La auditoria se escribe fuera de la respuesta (tap): se espera un instante a que termine.
      await new Promise((r) => setTimeout(r, 300));
      const audit = await prisma.auditoria_admin.findFirst({
        where: { id_actor: auditor.id, accion: 'OPERACIONES_CONSULTAR', resultado: 'EXITO' },
      });
      expect(audit).not.toBeNull();
    });

    it('rechaza identificadores y rangos inválidos con 400 (no 500)', async () => {
      const admin = await makeAdmin([SUPER_ROLE]);
      expect((await http().get('/api/admin/operations?accountId=no-es-uuid').set(auth(admin))).status).toBe(400);
      expect((await http().get('/api/admin/operations?clientId=1%27%20OR%201=1').set(auth(admin))).status).toBe(400);
      expect((await http().get('/api/admin/operations?from=2026-12-31&to=2026-01-01').set(auth(admin))).status).toBe(400);
      expect((await http().get('/api/admin/operations?minAmount=500&maxAmount=10').set(auth(admin))).status).toBe(400);
    });

    it('un término de búsqueda con caracteres de SQL se trata como texto literal', async () => {
      const admin = await makeAdmin([SUPER_ROLE]);
      const res = await http().get("/api/admin/operations?q=' OR 1=1 --").set(auth(admin));
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(0);
    });
  });

  describe('SCRUM-82 - Consulta de operaciones de solo lectura', () => {
    it('solo expone GET: POST/PUT/PATCH/DELETE sobre /admin/operations no existen (404)', async () => {
      const admin = await makeAdmin([SUPER_ROLE]);
      expect((await http().post('/api/admin/operations').set(auth(admin)).send({})).status).toBe(404);
      expect((await http().put('/api/admin/operations').set(auth(admin)).send({})).status).toBe(404);
      expect((await http().patch('/api/admin/operations').set(auth(admin)).send({})).status).toBe(404);
      expect((await http().delete('/api/admin/operations').set(auth(admin))).status).toBe(404);
    });

    it('consultar no altera saldos ni movimientos', async () => {
      const admin = await makeAdmin([SUPER_ROLE]);
      const client = await makeClient();
      const acc = await createAccount(client.id, 300);
      await http().post(`/api/accounts/${acc.id}/recharge`).set(auth(admin)).send({ amount: 20, description: 'Base' });

      const antesMov = await prisma.movimiento.count({ where: { id_cuenta: acc.id } });
      const antesSaldo = (await prisma.cuenta.findUnique({ where: { id: acc.id } }))?.saldo.toString();

      for (let i = 0; i < 3; i++) {
        const r = await http().get(`/api/admin/operations?accountId=${acc.id}`).set(auth(admin));
        expect(r.status).toBe(200);
      }

      const despuesMov = await prisma.movimiento.count({ where: { id_cuenta: acc.id } });
      const despuesSaldo = (await prisma.cuenta.findUnique({ where: { id: acc.id } }))?.saldo.toString();
      expect(despuesMov).toBe(antesMov);
      expect(despuesSaldo).toBe(antesSaldo);
    });

    it('la base de datos rechaza escrituras dentro de una transacción READ ONLY', async () => {
      await expect(
        prisma.$transaction(async (tx) => {
          await tx.$executeRaw`SET TRANSACTION READ ONLY`;
          await tx.$executeRaw`UPDATE movimiento SET descripcion = descripcion WHERE false`;
        }),
      ).rejects.toThrow();
    });
  });

  describe('SCRUM-86 - Impedir el acceso de usuarios bloqueados', () => {
    it('al bloquear: token anterior → 401, login → 401, y no puede operar', async () => {
      const admin = await makeAdmin([SUPER_ROLE]);
      const client = await makeClient();
      const acc = await createAccount(client.id, 100);

      expect((await http().get('/api/users/me').set(auth(client))).status).toBe(200);
      expect((await http().post(`/api/users/${client.id}/block`).set(auth(admin)).send({ reason: 'Fraude' })).status).toBe(201);

      expect((await http().get('/api/users/me').set(auth(client))).status).toBe(401);
      expect((await http().get('/api/accounts').set(auth(client))).status).toBe(401);
      expect(
        (
          await http()
            .post('/api/transactions/third-party')
            .set(auth(client))
            .send({ sourceAccountId: acc.id, amount: 1, destinationCci: '000' })
        ).status,
      ).toBe(401);

      const lg = await http().post('/api/auth/login').send({ email: client.email, password: PASSWORD });
      expect(lg.status).toBe(401);
      expect(lg.body.errorCode).toBe('ACCOUNT_BLOCKED');
    });

    it('bloquear vía PATCH (status=inactive) también cierra las sesiones activas', async () => {
      const admin = await makeAdmin([SUPER_ROLE]);
      const client = await makeClient();

      const res = await http()
        .patch(`/api/users/${client.id}`)
        .set(auth(admin))
        .send({ status: 'inactive', reason: 'Bloqueo por PATCH' });
      expect(res.status).toBe(200);

      const abiertas = await prisma.sesion.count({ where: { id_cliente: client.id, estado_sesion: 'ACTIVA' } });
      expect(abiertas).toBe(0);
      expect((await http().get('/api/users/me').set(auth(client))).status).toBe(401);
    });

    it('un usuario bloqueado no puede restablecer su contraseña para saltarse el bloqueo', async () => {
      const admin = await makeAdmin([SUPER_ROLE]);
      const client = await makeClient();
      await http().post(`/api/users/${client.id}/block`).set(auth(admin)).send({});

      const forgot = await http().post('/api/auth/forgot-password').send({ identifier: client.email });
      expect(forgot.status).toBe(200);

      // En desarrollo/test el código llega en devOtp; con él se intenta el reset
      const reset = await http()
        .post('/api/auth/reset-password')
        .send({ email: client.email, token: forgot.body.devOtp, newPassword: 'NuevaClave456!' });
      expect(reset.status).toBe(401);
      expect(reset.body.errorCode).toBe('ACCOUNT_BLOCKED');

      // Y sigue sin poder entrar
      const lg = await http().post('/api/auth/login').send({ email: client.email, password: PASSWORD });
      expect(lg.status).toBe(401);
    });

    it('al desbloquear recupera el acceso con un login nuevo (el token viejo sigue revocado)', async () => {
      const admin = await makeAdmin([SUPER_ROLE]);
      const client = await makeClient();
      await http().post(`/api/users/${client.id}/block`).set(auth(admin)).send({});
      await http().post(`/api/users/${client.id}/unblock`).set(auth(admin)).send({});

      expect((await http().get('/api/users/me').set(auth(client))).status).toBe(401);
      const token = await login(client.email);
      expect((await http().get('/api/users/me').set({ Authorization: `Bearer ${token}` })).status).toBe(200);
    });
  });
});
