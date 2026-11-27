import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const PASSWORD = 'Clave-Test-9';

describe('Sprint 3 - HU14 perfil de usuario (PostgreSQL real)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const http = () => request(app.getHttpServer());

  interface Actor {
    id: string;
    dni: string;
    email: string;
    token: string;
  }

  let seq = 0;
  async function makeActor(phone: string | null = '987654321'): Promise<Actor> {
    const n = `${Date.now()}${++seq}`.slice(-8);
    const email = `p${n}@test.local`;
    const c = await prisma.cliente.create({
      data: {
        dni: n,
        nombres: `Perfil${n}`,
        apellidos: 'Prueba',
        correo: email,
        telefono: phone,
        password_hash: bcrypt.hashSync(PASSWORD, 4),
        selfie_url: 'https://example.test/selfie.jpg',
      },
    });
    const res = await http().post('/api/auth/login').send({ email, password: PASSWORD });
    expect(res.status).toBe(200);
    return { id: c.id, dni: n, email, token: res.body.accessToken };
  }

  const auth = (a: Actor) => ({ Authorization: `Bearer ${a.token}` });

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

  describe('consulta del perfil propio', () => {
    it('GET /users/me devuelve los datos autorizados del titular del token', async () => {
      const A = await makeActor();
      const res = await http().get('/api/users/me').set(auth(A));
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        id: A.id,
        name: expect.stringContaining('Perfil'),
        email: A.email,
        role: 'client',
        dni: A.dni,
        phone: '987654321',
        status: 'active',
        registeredAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        updatedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      });
    });

    it('lista blanca: nunca expone hash, selfie, intentos, tokens ni datos internos', async () => {
      const A = await makeActor();
      const res = await http().get('/api/users/me').set(auth(A));
      expect(Object.keys(res.body).sort()).toEqual(
        ['dni', 'email', 'id', 'name', 'phone', 'registeredAt', 'role', 'status', 'updatedAt'].sort(),
      );
      const raw = JSON.stringify(res.body).toLowerCase();
      for (const forbidden of ['password', 'hash', 'selfie', 'token', 'intentos', 'bloqueo', 'kind']) {
        expect(raw).not.toContain(forbidden);
      }
      expect(raw).not.toContain(A.token.toLowerCase());
    });

    it('telefono ausente se omite en vez de devolver null', async () => {
      const A = await makeActor(null);
      const res = await http().get('/api/users/me').set(auth(A));
      expect(res.status).toBe(200);
      expect(res.body).not.toHaveProperty('phone');
    });

    it('los datos salen de la BD y no del token: un cambio posterior se refleja', async () => {
      const A = await makeActor();
      await prisma.cliente.update({ where: { id: A.id }, data: { telefono: '911111111' } });
      const res = await http().get('/api/users/me').set(auth(A));
      expect(res.body.phone).toBe('911111111');
    });

    it('GET /auth/profile devuelve exactamente el mismo perfil (contrato del front)', async () => {
      const A = await makeActor();
      const a = await http().get('/api/auth/profile').set(auth(A));
      const b = await http().get('/api/users/me').set(auth(A));
      expect(a.status).toBe(200);
      expect(a.body).toEqual(b.body);
    });
  });

  describe('proteccion contra acceso a perfiles ajenos', () => {
    let A: Actor, B: Actor;
    beforeAll(async () => {
      A = await makeActor();
      B = await makeActor();
    });

    it('sin token, con token malformado o firmado con otra clave -> 401', async () => {
      expect((await http().get('/api/users/me')).status).toBe(401);
      expect((await http().get('/api/users/me').set('Authorization', 'Bearer basura')).status).toBe(401);
      expect((await http().get('/api/auth/profile')).status).toBe(401);
      const forged = [
        Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url'),
        Buffer.from(JSON.stringify({ sub: B.id, email: B.email, role: 'admin' })).toString('base64url'),
        '',
      ].join('.');
      expect((await http().get('/api/users/me').set('Authorization', `Bearer ${forged}`)).status).toBe(401);
    });

    it('id, userId, email o dni en query/body/header se ignoran: siempre responde el titular', async () => {
      const q = await http().get('/api/users/me').query({ id: B.id, userId: B.id, email: B.email, dni: B.dni }).set(auth(A));
      expect(q.status).toBe(200);
      expect(q.body.id).toBe(A.id);

      const h = await http().get('/api/users/me').set(auth(A)).set('X-User-Id', B.id);
      expect(h.body.id).toBe(A.id);

      const p = await http().get('/api/auth/profile').query({ id: B.id }).set(auth(A));
      expect(p.body.id).toBe(A.id);
    });

    it('no existe ruta para leer el perfil de otro por id: /users/<id> y /users/me/<id> -> 404 o 403, sin datos', async () => {
      for (const path of [`/api/users/${B.id}`, `/api/users/me/${B.id}`, `/api/users/${B.id}/profile`]) {
        const res = await http().get(path).set(auth(A));
        expect([403, 404]).toContain(res.status);
        expect(JSON.stringify(res.body)).not.toContain(B.email);
      }
    });

    it('un cliente no puede listar, modificar ni borrar a otros (403)', async () => {
      expect((await http().get('/api/users').set(auth(A))).status).toBe(403);
      expect((await http().patch(`/api/users/${B.id}`).set(auth(A)).send({ name: 'x' })).status).toBe(403);
      expect((await http().delete(`/api/users/${B.id}`).set(auth(A))).status).toBe(403);
      // B sigue intacto.
      const b = await http().get('/api/users/me').set(auth(B));
      expect(b.body.email).toBe(B.email);
    });

    it('tras cerrar sesion el mismo token ya no da acceso (401)', async () => {
      const C = await makeActor();
      expect((await http().get('/api/users/me').set(auth(C))).status).toBe(200);
      expect((await http().post('/api/auth/logout').set(auth(C))).status).toBe(200);
      expect((await http().get('/api/users/me').set(auth(C))).status).toBe(401);
    });

    it('cuenta desactivada -> sin acceso al perfil', async () => {
      const D = await makeActor();
      await prisma.cliente.update({ where: { id: D.id }, data: { estado: 'INACTIVO' } });
      const res = await http().get('/api/users/me').set(auth(D));
      expect([401, 403, 404]).toContain(res.status);
      expect(res.body).not.toHaveProperty('email');
    });
  });
});
