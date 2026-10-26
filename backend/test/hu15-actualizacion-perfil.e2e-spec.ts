import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import * as bcrypt from 'bcryptjs';
import express = require('express');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { databaseTlsWarning, httpsOnly, isHttpsEnforced } from '../src/common/transport-security';

const PASSWORD = 'Clave-Test-9';

describe('Sprint 3 - HU15 actualizacion del perfil (PostgreSQL real)', () => {
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

  async function makeActor(): Promise<Actor> {
    const n = uniq();
    const email = `u${n}@test.local`;
    const c = await prisma.cliente.create({
      data: {
        dni: n,
        nombres: `Edita${n}`,
        apellidos: 'Prueba',
        correo: email,
        telefono: '900000001',
        password_hash: bcrypt.hashSync(PASSWORD, 4),
      },
    });
    const res = await http().post('/api/auth/login').send({ email, password: PASSWORD });
    expect(res.status).toBe(200);
    return { id: c.id, email, token: res.body.accessToken };
  }

  const auth = (a: Actor) => ({ Authorization: `Bearer ${a.token}` });
  const patch = (a: Actor, body: unknown) => http().patch('/api/users/me').set(auth(a)).send(body as object);
  const profile = async (a: Actor) => (await http().get('/api/users/me').set(auth(a))).body;
  const row = (id: string) => prisma.cliente.findUnique({ where: { id } });

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('validaciones', () => {
    let A: Actor;
    beforeAll(async () => {
      A = await makeActor();
    });

    it('exige autenticacion (401)', async () => {
      expect((await http().patch('/api/users/me').send({ phone: '911111111' })).status).toBe(401);
    });

    it('cuerpo vacio o sin cambios reales -> 400 NO_CHANGES', async () => {
      const empty = await patch(A, {});
      expect(empty.status).toBe(400);
      expect(empty.body.error).toBe('NO_CHANGES');
      const same = await patch(A, { phone: '900000001' });
      expect(same.status).toBe(400);
      expect(same.body.error).toBe('NO_CHANGES');
    });

    it('formatos invalidos -> 400 y el valor enviado no se devuelve en el error', async () => {
      for (const body of [{ phone: '12345' }, { phone: '812345678' }, { email: 'no-es-correo' }, { email: `${'a'.repeat(250)}@x.com` }]) {
        const res = await patch(A, body);
        expect(res.status).toBe(400);
        const echoed = Object.values(body)[0] as string;
        expect(JSON.stringify(res.body)).not.toContain(echoed);
      }
      expect((await patch(A, { phone: null })).status).toBe(400);
      expect((await patch(A, { email: 123 })).status).toBe(400);
      expect((await patch(A, { expectedUpdatedAt: 'ayer' })).status).toBe(400);
    });

    it('campos desconocidos -> 400', async () => {
      const res = await patch(A, { phone: '911111111', foo: 'bar' });
      expect(res.status).toBe(400);
      expect((await row(A.id)).telefono).toBe('900000001');
    });
  });

  describe('autorizacion por campo', () => {
    it('name, dni, rol, estado, id y secretos -> 403 y NADA se persiste (ni el campo valido del mismo cuerpo)', async () => {
      const A = await makeActor();
      const before = await row(A.id);
      for (const extra of [
        { role: 'admin' },
        { rol: 'ADMIN' },
        { name: 'Otro Nombre' },
        { dni: '11111111' },
        { status: 'inactive' },
        { id: '00000000-0000-0000-0000-000000000000' },
        { passwordHash: 'x' },
        { password: 'Nueva-Clave-1' },
      ]) {
        const res = await patch(A, { phone: '955555555', ...extra });
        expect(res.status).toBe(403);
        expect(res.body.error).toBe('FIELD_NOT_EDITABLE');
      }
      const after = await row(A.id);
      expect(after.telefono).toBe('900000001');
      expect(after.rol).toBe('CLIENTE');
      expect(after.dni).toBe(before.dni);
      expect(after.nombres).toBe(before.nombres);
      expect(after.password_hash).toBe(before.password_hash);
    });

    it('PATCH /users/:id (gestion de clientes) sigue vedado a un cliente (403)', async () => {
      const A = await makeActor();
      const B = await makeActor();
      expect((await http().patch(`/api/users/${B.id}`).set(auth(A)).send({ email: 'x@x.com' })).status).toBe(403);
      expect((await http().patch(`/api/users/${A.id}`).set(auth(A)).send({ role: 'admin' })).status).toBe(403);
    });

    it('un id en query o header no cambia a quien se actualiza: siempre el titular del token', async () => {
      const A = await makeActor();
      const B = await makeActor();
      const res = await http().patch('/api/users/me').query({ id: B.id }).set(auth(A)).set('X-User-Id', B.id).send({ phone: '977777777' });
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(A.id);
      expect((await row(A.id)).telefono).toBe('977777777');
      expect((await row(B.id)).telefono).toBe('900000001');
    });
  });

  describe('actualizacion y reglas de negocio', () => {
    it('cambia el telefono (normalizado) y avanza updatedAt', async () => {
      const A = await makeActor();
      const before = await profile(A);
      const res = await patch(A, { phone: '+51 977-123-456' });
      expect(res.status).toBe(200);
      expect(res.body.phone).toBe('977123456');
      expect(new Date(res.body.updatedAt).getTime()).toBeGreaterThan(new Date(before.updatedAt).getTime());
      expect((await profile(A)).phone).toBe('977123456');
    });

    it('cambiar el correo exige la contrasena actual', async () => {
      const A = await makeActor();
      const none = await patch(A, { email: `nuevo${uniq()}@test.local` });
      expect(none.status).toBe(400);
      expect(none.body.error).toBe('CURRENT_PASSWORD_REQUIRED');

      const wrong = await patch(A, { email: `nuevo${uniq()}@test.local`, currentPassword: 'Incorrecta-1' });
      expect(wrong.status).toBe(403);
      expect(wrong.body.error).toBe('INVALID_CURRENT_PASSWORD');
      expect(JSON.stringify(wrong.body)).not.toContain('Incorrecta-1');
      expect((await row(A.id)).correo).toBe(A.email);

      const target = `Nuevo${uniq()}@Test.Local`;
      const ok = await patch(A, { email: target, currentPassword: PASSWORD });
      expect(ok.status).toBe(200);
      expect(ok.body.email).toBe(target.toLowerCase());
      expect((await row(A.id)).correo).toBe(target.toLowerCase());
    });

    it('correo ya usado (sin distinguir mayusculas) -> 409 y el telefono del mismo cuerpo tampoco se aplica', async () => {
      const A = await makeActor();
      const B = await makeActor();
      const res = await patch(A, { email: B.email.toUpperCase(), phone: '966666666', currentPassword: PASSWORD });
      expect(res.status).toBe(409);
      expect(res.body.error).toBe('EMAIL_IN_USE');
      const after = await row(A.id);
      expect(after.correo).toBe(A.email);
      expect(after.telefono).toBe('900000001');
    });

    it('el correo de un administrador tampoco se puede tomar', async () => {
      const A = await makeActor();
      const adminEmail = `adm${uniq()}@test.local`;
      await prisma.admin.create({ data: { nombre_usuario: 'Admin X', correo: adminEmail, password_hash: bcrypt.hashSync(PASSWORD, 4) } });
      const res = await patch(A, { email: adminEmail, currentPassword: PASSWORD });
      expect(res.status).toBe(409);
    });

    it('administrador: puede cambiar su correo pero no tiene telefono (403)', async () => {
      const email = `adm${uniq()}@test.local`;
      const adm = await prisma.admin.create({ data: { nombre_usuario: 'Admin Y', correo: email, password_hash: bcrypt.hashSync(PASSWORD, 4) } });
      await prisma.admin_rol.create({ data: { id_admin: adm.id, id_rol: 2 } });
      const login = await http().post('/api/auth/login').send({ email, password: PASSWORD });
      expect(login.status).toBe(200);
      const token = { Authorization: `Bearer ${login.body.accessToken}` };
      expect((await http().patch('/api/users/me').set(token).send({ phone: '911111111' })).status).toBe(403);
      const newEmail = `adm${uniq()}@test.local`;
      const ok = await http().patch('/api/users/me').set(token).send({ email: newEmail, currentPassword: PASSWORD });
      expect(ok.status).toBe(200);
      expect(ok.body.email).toBe(newEmail);
      expect((await prisma.admin.findUnique({ where: { id: adm.id } })).correo).toBe(newEmail);
    });
  });

  describe('concurrencia y consistencia', () => {
    it('expectedUpdatedAt: la segunda escritura con una version vieja -> 409 y no pisa la primera', async () => {
      const A = await makeActor();
      const v0 = (await profile(A)).updatedAt;
      const first = await patch(A, { phone: '911000001', expectedUpdatedAt: v0 });
      expect(first.status).toBe(200);
      const stale = await patch(A, { phone: '911000002', expectedUpdatedAt: v0 });
      expect(stale.status).toBe(409);
      expect(stale.body.error).toBe('PROFILE_CONFLICT');
      expect((await row(A.id)).telefono).toBe('911000001');
      // Releyendo la version vigente, la escritura procede.
      const v1 = (await profile(A)).updatedAt;
      expect((await patch(A, { phone: '911000003', expectedUpdatedAt: v1 })).status).toBe(200);
    });

    it('dos peticiones simultaneas con la misma version: exactamente una gana', async () => {
      const A = await makeActor();
      const v0 = (await profile(A)).updatedAt;
      const results = await Promise.all(
        ['922000001', '922000002', '922000003', '922000004'].map((phone) => patch(A, { phone, expectedUpdatedAt: v0 })),
      );
      expect(results.filter((r) => r.status === 200)).toHaveLength(1);
      expect(results.filter((r) => r.status === 409)).toHaveLength(3);
      const winner = results.find((r) => r.status === 200).body.phone;
      expect((await row(A.id)).telefono).toBe(winner);
    });

    it('dos clientes que piden el mismo correo a la vez: uno obtiene 200 y el otro 409', async () => {
      const A = await makeActor();
      const B = await makeActor();
      const target = `carrera${uniq()}@test.local`;
      const [ra, rb] = await Promise.all([
        patch(A, { email: target, currentPassword: PASSWORD }),
        patch(B, { email: target, currentPassword: PASSWORD }),
      ]);
      expect([ra.status, rb.status].sort()).toEqual([200, 409]);
      const owners = await prisma.cliente.count({ where: { correo: target } });
      expect(owners).toBe(1);
    });
  });

  describe('datos personales fuera de URL y errores', () => {
    it('el endpoint no usa parametros de ruta ni query: no existe PATCH con datos en la URL', async () => {
      const A = await makeActor();
      const res = await http().patch(`/api/users/me/${encodeURIComponent('911111111')}`).set(auth(A)).send({});
      expect(res.status).toBe(404);
    });

    it('los errores 4xx no devuelven correo, telefono ni contrasena enviados', async () => {
      const A = await makeActor();
      const email = `secreto${uniq()}@test.local`;
      const res = await patch(A, { email, phone: '999999999', currentPassword: 'Secreta-Pass-1', extra: 'x' });
      expect(res.status).toBe(400);
      const raw = JSON.stringify(res.body);
      for (const v of [email, '999999999', 'Secreta-Pass-1']) expect(raw).not.toContain(v);
    });
  });
});

describe('Sprint 3 - HU15 seguridad de transporte', () => {
  const buildApp = (enabled: boolean) => {
    const a = express();
    a.set('trust proxy', 1);
    a.use(httpsOnly(enabled));
    a.get('/api/ping', (_req, res) => res.json({ ok: true }));
    a.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
    return a;
  };

  it('HTTP plano -> 426 sin redirigir; con X-Forwarded-Proto: https -> pasa', async () => {
    const a = buildApp(true);
    const plain = await request(a).get('/api/ping');
    expect(plain.status).toBe(426);
    expect(plain.headers.location).toBeUndefined();
    expect(plain.body.error).toBe('HTTPS_REQUIRED');
    expect((await request(a).get('/api/ping').set('X-Forwarded-Proto', 'https')).status).toBe(200);
  });

  it('POST con datos personales por HTTP plano tambien se rechaza', async () => {
    expect((await request(buildApp(true)).post('/api/ping').send({ phone: '911111111' })).status).toBe(426);
  });

  it('health queda exento y, desactivado, no bloquea nada', async () => {
    expect((await request(buildApp(true)).get('/api/health')).status).toBe(200);
    expect((await request(buildApp(false)).get('/api/ping')).status).toBe(200);
  });

  it('HTTPS se exige en produccion salvo FORCE_HTTPS=false', () => {
    expect(isHttpsEnforced({ NODE_ENV: 'production' } as NodeJS.ProcessEnv)).toBe(true);
    expect(isHttpsEnforced({ NODE_ENV: 'production', FORCE_HTTPS: 'false' } as NodeJS.ProcessEnv)).toBe(false);
    expect(isHttpsEnforced({ NODE_ENV: 'development' } as NodeJS.ProcessEnv)).toBe(false);
  });

  it('advierte de BD remota sin TLS y no filtra la cadena de conexion', () => {
    const prod = (url: string) => ({ NODE_ENV: 'production', DATABASE_URL: url }) as NodeJS.ProcessEnv;
    const warn = databaseTlsWarning(prod('postgresql://u:clave-secreta@db.ejemplo.com:5432/x'));
    expect(warn).toContain('TLS');
    expect(warn).not.toContain('clave-secreta');
    expect(databaseTlsWarning(prod('postgresql://u:p@db.ejemplo.com:5432/x?sslmode=require'))).toBeNull();
    expect(databaseTlsWarning(prod('postgresql://u:p@pg.railway.internal:5432/x'))).toBeNull();
    expect(databaseTlsWarning({ NODE_ENV: 'development', DATABASE_URL: 'postgresql://u:p@db.ejemplo.com/x' } as NodeJS.ProcessEnv)).toBeNull();
  });
});
