import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const PASSWORD = 'Clave-Test-9';

describe('Sprint 3 - HU13 notificaciones de transferencia recibida (PostgreSQL real)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const http = () => request(app.getHttpServer());

  interface Actor {
    id: string;
    token: string;
    accounts: { id: string; cci: string }[];
  }

  let seq = 0;
  async function makeActor(saldo: string, moneda: 'PEN' | 'USD' = 'PEN'): Promise<Actor> {
    const n = `${Date.now()}${++seq}`.slice(-8);
    const email = `n${n}@test.local`;
    const c = await prisma.cliente.create({
      data: {
        dni: n,
        nombres: `Remitente${n}`,
        apellidos: 'Prueba',
        correo: email,
        password_hash: bcrypt.hashSync(PASSWORD, 4),
      },
    });
    const cci = `191-${n}00-00`;
    const a = await prisma.cuenta.create({
      data: { id_cliente: c.id, id_tipo_cuenta: 1, moneda, cci, saldo },
    });
    const res = await http().post('/api/auth/login').send({ email, password: PASSWORD });
    expect(res.status).toBe(200);
    return { id: c.id, token: res.body.accessToken, accounts: [{ id: a.id, cci }] };
  }

  const auth = (a: Actor) => ({ Authorization: `Bearer ${a.token}` });
  const thirdParty = (a: Actor, body: any, key: string = randomUUID()) =>
    http().post('/api/transactions/third-party').set(auth(a)).set('Idempotency-Key', key).send(body);
  const send = (from: Actor, to: Actor, amount: number, key?: string) =>
    thirdParty(from, { sourceAccountId: from.accounts[0].id, destinationCci: to.accounts[0].cci, amount }, key);
  const listOf = (a: Actor) => http().get('/api/notifications').set(auth(a));

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

  describe('generacion', () => {
    it('una transferencia a tercero notifica solo al receptor, con origen, monto, moneda y fecha', async () => {
      const A = await makeActor('1000.00');
      const B = await makeActor('0.00');
      const res = await send(A, B, 250);
      expect(res.status).toBe(201);

      const list = await listOf(B);
      expect(list.status).toBe(200);
      expect(list.body).toHaveLength(1);
      const n = list.body[0];
      expect(n).toMatchObject({ type: 'transfer', unread: true, amount: '250.00', currency: 'PEN' });
      expect(n.transferOrigin).toContain(`Remitente`);
      expect(n.transferOrigin).toMatch(/\*{4}\d{4}$/);
      expect(n.receivingAccount).toMatch(/^\*{4}\d{4}$/);
      expect(new Date(n.date).getTime()).not.toBeNaN();
      // El CCI completo nunca se expone.
      expect(JSON.stringify(n)).not.toContain(A.accounts[0].cci);
      expect(JSON.stringify(n)).not.toContain(B.accounts[0].cci);

      expect((await listOf(A)).body).toHaveLength(0);
    });

    it('una transferencia entre cuentas propias no genera notificacion', async () => {
      const A = await makeActor('1000.00');
      const extra = await prisma.cuenta.create({
        data: { id_cliente: A.id, id_tipo_cuenta: 1, moneda: 'PEN', cci: `191-${Date.now()}9-99`, saldo: '0' },
      });
      const res = await http()
        .post('/api/transactions/internal')
        .set(auth(A))
        .set('Idempotency-Key', randomUUID())
        .send({ sourceAccountId: A.accounts[0].id, destinationAccountId: extra.id, amount: 50 });
      expect(res.status).toBe(201);
      expect((await listOf(A)).body).toHaveLength(0);
    });

    it('un reintento con la misma Idempotency-Key no duplica la notificacion', async () => {
      const A = await makeActor('1000.00');
      const B = await makeActor('0.00');
      const key = randomUUID();
      await send(A, B, 100, key);
      await send(A, B, 100, key);
      await Promise.all(Array.from({ length: 5 }, () => send(A, B, 100, key)));
      expect((await listOf(B)).body).toHaveLength(1);
    });

    it('el UNIQUE evita duplicados aun si se reprocesa la misma transferencia', async () => {
      const A = await makeActor('1000.00');
      const B = await makeActor('0.00');
      const res = await send(A, B, 10);
      const n = await prisma.notificacion.findFirst({ where: { id_cliente: B.id } });
      await expect(
        prisma.notificacion.create({
          data: {
            id_cliente: B.id,
            titulo: 'dup',
            detalle: 'dup',
            id_transferencia_externa: res.body.transferId,
            id_cuenta_destino: n.id_cuenta_destino,
          },
        }),
      ).rejects.toBeDefined();
    });

    it('una transferencia fallida (saldo insuficiente) no deja notificacion', async () => {
      const A = await makeActor('10.00');
      const B = await makeActor('0.00');
      const res = await send(A, B, 500);
      expect(res.status).toBe(422);
      expect((await listOf(B)).body).toHaveLength(0);
    });

    it('conserva la moneda de la transferencia', async () => {
      const A = await makeActor('100.00', 'USD');
      const B = await makeActor('0.00', 'USD');
      await send(A, B, 20);
      expect((await listOf(B)).body[0]).toMatchObject({ amount: '20.00', currency: 'USD' });
    });
  });

  describe('consulta y privacidad', () => {
    let A: Actor, B: Actor, C: Actor;
    let notificationOfB: string;
    beforeAll(async () => {
      A = await makeActor('5000.00');
      B = await makeActor('0.00');
      C = await makeActor('0.00');
      await send(A, B, 30);
      await send(A, B, 40);
      await send(A, C, 70);
      notificationOfB = (await listOf(B)).body[0].id;
    });

    it('requiere autenticacion (401)', async () => {
      expect((await http().get('/api/notifications')).status).toBe(401);
      expect((await http().get(`/api/notifications/${notificationOfB}`)).status).toBe(401);
    });

    it('cada cliente ve solo las suyas, mas recientes primero', async () => {
      const b = await listOf(B);
      expect(b.body).toHaveLength(2);
      expect(b.body.map((n: any) => n.amount)).toEqual(['40.00', '30.00']);
      const c = await listOf(C);
      expect(c.body).toHaveLength(1);
      expect(c.body[0].amount).toBe('70.00');
    });

    it('parametros de identidad en la query se ignoran', async () => {
      const res = await http().get('/api/notifications').query({ clienteId: C.id, customerId: C.id }).set(auth(B));
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
    });

    it('detalle propio -> 200; notificacion ajena -> 404 (IDOR)', async () => {
      const own = await http().get(`/api/notifications/${notificationOfB}`).set(auth(B));
      expect(own.status).toBe(200);
      expect(own.body.id).toBe(notificationOfB);
      expect(own.body.amount).toBe('40.00');

      const foreign = await http().get(`/api/notifications/${notificationOfB}`).set(auth(C));
      expect(foreign.status).toBe(404);
      const missing = await http().get(`/api/notifications/${randomUUID()}`).set(auth(C));
      expect(missing.status).toBe(404);
      expect(foreign.body.message).toBe(missing.body.message);
    });

    it('identificadores manipulados -> 404 sin error interno', async () => {
      for (const id of ["' OR 1=1 --", '1', '../accounts', 'null']) {
        const res = await http().get(`/api/notifications/${encodeURIComponent(id)}`).set(auth(B));
        expect(res.status).toBe(404);
      }
    });

    it('paginacion invalida -> 400', async () => {
      expect((await http().get('/api/notifications?pageSize=1000').set(auth(B))).status).toBe(400);
      expect((await http().get('/api/notifications?page=0').set(auth(B))).status).toBe(400);
    });

    it('paginacion: pageSize y page recortan la lista propia', async () => {
      const p1 = await http().get('/api/notifications?pageSize=1&page=1').set(auth(B));
      const p2 = await http().get('/api/notifications?pageSize=1&page=2').set(auth(B));
      expect(p1.body).toHaveLength(1);
      expect(p2.body).toHaveLength(1);
      expect(p1.body[0].id).not.toBe(p2.body[0].id);
    });

    it('alias GET /accounts/notifications devuelve lo mismo y tambien aisla por cliente', async () => {
      const res = await http().get('/api/accounts/notifications').set(auth(B));
      expect(res.status).toBe(200);
      expect(res.body.map((n: any) => n.id)).toEqual((await listOf(B)).body.map((n: any) => n.id));
    });
  });

  describe('marcado como leida', () => {
    let A: Actor, B: Actor, C: Actor;
    beforeAll(async () => {
      A = await makeActor('5000.00');
      B = await makeActor('0.00');
      C = await makeActor('0.00');
      await send(A, B, 11);
      await send(A, B, 12);
      await send(A, C, 13);
    });

    it('PATCH /:id/read marca solo la propia; ajena -> 404 y no se altera', async () => {
      const [first] = (await listOf(B)).body;
      const foreign = await http().patch(`/api/notifications/${first.id}/read`).set(auth(C));
      expect(foreign.status).toBe(404);
      expect((await http().get(`/api/notifications/${first.id}`).set(auth(B))).body.unread).toBe(true);

      const own = await http().patch(`/api/notifications/${first.id}/read`).set(auth(B));
      expect(own.status).toBe(200);
      expect(own.body.unread).toBe(false);
    });

    it('PATCH /read-all marca solo las del cliente autenticado', async () => {
      const res = await http().patch('/api/notifications/read-all').set(auth(B));
      expect(res.status).toBe(200);
      expect((await listOf(B)).body.every((n: any) => n.unread === false)).toBe(true);
      expect((await listOf(C)).body.every((n: any) => n.unread === true)).toBe(true);
    });
  });
});
