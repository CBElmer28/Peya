import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const PASSWORD = 'Clave-Test-9';

describe('Sprint 2 - cuentas, movimientos y transferencias (PostgreSQL real)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const http = () => request(app.getHttpServer());

  interface Actor {
    id: string;
    email: string;
    token: string;
    accounts: { id: string; cci: string }[];
  }

  let seq = 0;
  async function makeActor(accounts: { saldo: string; moneda?: 'PEN' | 'USD' }[]): Promise<Actor> {
    const n = `${Date.now()}${++seq}`.slice(-8);
    const email = `t${n}@test.local`;
    const c = await prisma.cliente.create({
      data: {
        dni: n,
        nombres: `Cliente ${n}`,
        apellidos: 'Prueba',
        correo: email,
        password_hash: bcrypt.hashSync(PASSWORD, 4),
      },
    });
    const accs: Actor['accounts'] = [];
    for (let i = 0; i < accounts.length; i++) {
      const cci = `191-${n}${String(i).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const a = await prisma.cuenta.create({
        data: {
          id_cliente: c.id,
          id_tipo_cuenta: 1,
          moneda: accounts[i].moneda ?? 'PEN',
          cci,
          saldo: accounts[i].saldo,
        },
      });
      accs.push({ id: a.id, cci });
    }
    const res = await http().post('/api/auth/login').send({ email, password: PASSWORD });
    expect(res.status).toBe(200);
    return { id: c.id, email, token: res.body.accessToken, accounts: accs };
  }

  const auth = (a: Actor) => ({ Authorization: `Bearer ${a.token}` });
  const saldo = async (accountId: string) => Number((await prisma.cuenta.findUnique({ where: { id: accountId } })).saldo);

  const internal = (a: Actor, body: any, key: string = randomUUID()) =>
    http().post('/api/transactions/internal').set(auth(a)).set('Idempotency-Key', key).send(body);
  const thirdParty = (a: Actor, body: any, key: string = randomUUID()) =>
    http().post('/api/transactions/third-party').set(auth(a)).set('Idempotency-Key', key).send(body);

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

  describe('Autenticacion y ownership (HU06/HU07)', () => {
    let A: Actor, B: Actor;
    beforeAll(async () => {
      A = await makeActor([{ saldo: '1000.00' }]);
      B = await makeActor([{ saldo: '2000.00' }]);
    });

    it('rechaza peticiones sin token (401)', async () => {
      for (const path of ['/api/accounts', '/api/movements', '/api/transactions/recent-recipients']) {
        expect((await http().get(path)).status).toBe(401);
      }
      expect((await http().post('/api/transactions/internal').send({})).status).toBe(401);
    });

    it('HU06: cada usuario ve solo sus cuentas, con numero enmascarado', async () => {
      const res = await http().get('/api/accounts').set(auth(A));
      expect(res.status).toBe(200);
      expect(res.body.map((x: any) => x.id)).toEqual([A.accounts[0].id]);
      expect(res.body[0].maskedNumber).toMatch(/^\*{4}\d{4}$/);
      expect(JSON.stringify(res.body)).not.toContain(A.accounts[0].cci);
    });

    it('HU07: cuenta propia -> 200; cuenta de otro -> 404 (IDOR)', async () => {
      const own = await http().get(`/api/accounts/${A.accounts[0].id}`).set(auth(A));
      expect(own.status).toBe(200);
      expect(own.body.account.id).toBe(A.accounts[0].id);
      const other = await http().get(`/api/accounts/${B.accounts[0].id}`).set(auth(A));
      expect(other.status).toBe(404);
      expect(JSON.stringify(other.body)).not.toContain('2000');
      expect((await http().get('/api/accounts/no-es-uuid').set(auth(A))).status).toBe(404);
      expect((await http().get(`/api/accounts/${randomUUID()}`).set(auth(A))).status).toBe(404);
    });

    it('HU08: accountId ajeno en el filtro -> 404 y customerId en query se ignora', async () => {
      const r = await http().get('/api/movements').query({ accountId: B.accounts[0].id }).set(auth(A));
      expect(r.status).toBe(404);
      const r2 = await http().get('/api/movements').query({ customerId: B.id }).set(auth(A));
      expect(r2.status).toBe(200);
      expect(r2.body.total).toBe(0);
    });
  });

  describe('HU05 - apertura de cuenta', () => {
    it('requiere Idempotency-Key', async () => {
      const A = await makeActor([]);
      const r = await http().post('/api/accounts').set(auth(A)).send({ type: 'savings', currency: 'PEN' });
      expect(r.status).toBe(400);
      expect(r.body.error).toBe('IDEMPOTENCY_KEY_REQUIRED');
    });

    it('crea la cuenta con saldo 0 y estado activo; el reintento no duplica', async () => {
      const A = await makeActor([]);
      const key = randomUUID();
      const send = () =>
        http().post('/api/accounts').set(auth(A)).set('Idempotency-Key', key).send({ type: 'savings', currency: 'PEN' });
      const r1 = await send();
      expect(r1.status).toBe(201);
      expect(r1.body.numericBalance).toBe(0);
      expect(r1.body.status).toBe('active');
      const r2 = await send();
      expect(r2.status).toBe(201);
      expect(r2.body.id).toBe(r1.body.id);
      expect(await prisma.cuenta.count({ where: { id_cliente: A.id } })).toBe(1);
    });

    it('la misma clave con otro cuerpo -> 422', async () => {
      const A = await makeActor([]);
      const key = randomUUID();
      await http().post('/api/accounts').set(auth(A)).set('Idempotency-Key', key).send({ type: 'savings', currency: 'PEN' });
      const r = await http().post('/api/accounts').set(auth(A)).set('Idempotency-Key', key).send({ type: 'checking', currency: 'PEN' });
      expect(r.status).toBe(422);
      expect(r.body.error).toBe('IDEMPOTENCY_KEY_REUSED');
    });

    it('10 solicitudes concurrentes con la misma clave crean UNA sola cuenta', async () => {
      const A = await makeActor([]);
      const key = randomUUID();
      const rs = await Promise.all(
        Array.from({ length: 10 }, () =>
          http().post('/api/accounts').set(auth(A)).set('Idempotency-Key', key).send({ type: 'checking', currency: 'PEN' }),
        ),
      );
      expect(rs.every((r) => r.status === 201)).toBe(true);
      expect(new Set(rs.map((r) => r.body.id)).size).toBe(1);
      expect(await prisma.cuenta.count({ where: { id_cliente: A.id } })).toBe(1);
    });

    it('aplica el maximo de cuentas incluso con solicitudes concurrentes distintas', async () => {
      const A = await makeActor([]);
      const rs = await Promise.all(
        Array.from({ length: 8 }, () =>
          http().post('/api/accounts').set(auth(A)).set('Idempotency-Key', randomUUID()).send({ type: 'savings', currency: 'PEN' }),
        ),
      );
      expect(rs.filter((r) => r.status === 201).length).toBe(4);
      expect(rs.filter((r) => r.status === 422).every((r) => r.body.error === 'ACCOUNT_LIMIT_REACHED')).toBe(true);
      expect(await prisma.cuenta.count({ where: { id_cliente: A.id } })).toBe(4);
    });

    it('valida tipo/moneda', async () => {
      const A = await makeActor([]);
      const bad = await http().post('/api/accounts').set(auth(A)).set('Idempotency-Key', randomUUID()).send({ type: 'x', currency: 'PEN' });
      expect(bad.status).toBe(400);
      const usd = await http().post('/api/accounts').set(auth(A)).set('Idempotency-Key', randomUUID()).send({ type: 'usd', currency: 'PEN' });
      expect(usd.status).toBe(422);
    });
  });

  describe('HU09 - transferencias entre cuentas propias', () => {
    let A: Actor, B: Actor;
    beforeEach(async () => {
      A = await makeActor([{ saldo: '1000.00' }, { saldo: '500.00' }, { saldo: '10.00', moneda: 'USD' }]);
      B = await makeActor([{ saldo: '300.00' }]);
    });

    it('debita, acredita, registra 2 movimientos y estado COMPLETADO', async () => {
      const r = await internal(A, { sourceAccountId: A.accounts[0].id, destinationAccountId: A.accounts[1].id, amount: 250.5, description: 'Ahorro' });
      expect(r.status).toBe(201);
      expect(r.body.newBalance).toBe(749.5);
      expect(await saldo(A.accounts[0].id)).toBe(749.5);
      expect(await saldo(A.accounts[1].id)).toBe(750.5);
      const movs = await prisma.movimiento.findMany({ where: { id_transferencia_interna: r.body.transferId } });
      expect(movs.map((m) => m.tipo).sort()).toEqual(['CREDITO', 'DEBITO']);
      const t = await prisma.transferencia_internas.findUnique({ where: { id: r.body.transferId } });
      expect(t.estado).toBe('COMPLETADO');
    });

    it('rechaza: saldo insuficiente, monto <= 0, mismo origen/destino, moneda distinta', async () => {
      const base = { sourceAccountId: A.accounts[0].id, destinationAccountId: A.accounts[1].id };
      const ins = await internal(A, { ...base, amount: 1000.01 });
      expect(ins.status).toBe(422);
      expect(ins.body.error).toBe('INSUFFICIENT_FUNDS');
      expect((await internal(A, { ...base, amount: 0 })).status).toBe(400);
      expect((await internal(A, { ...base, amount: -5 })).status).toBe(400);
      expect((await internal(A, { ...base, amount: 1.234 })).status).toBe(400);
      const same = await internal(A, { sourceAccountId: A.accounts[0].id, destinationAccountId: A.accounts[0].id, amount: 5 });
      expect(same.status).toBe(422);
      expect(same.body.error).toBe('SAME_ACCOUNT');
      const cur = await internal(A, { ...base, destinationAccountId: A.accounts[2].id, amount: 5 });
      expect(cur.body.error).toBe('CURRENCY_MISMATCH');
      expect(await saldo(A.accounts[0].id)).toBe(1000);
    });

    it('ownership: origen o destino de otro cliente / inexistente -> 404 sin mover dinero', async () => {
      const foreignSrc = await internal(A, { sourceAccountId: B.accounts[0].id, destinationAccountId: A.accounts[0].id, amount: 10 });
      expect(foreignSrc.status).toBe(404);
      const foreignDst = await internal(A, { sourceAccountId: A.accounts[0].id, destinationAccountId: B.accounts[0].id, amount: 10 });
      expect(foreignDst.status).toBe(404);
      const none = await internal(A, { sourceAccountId: A.accounts[0].id, destinationAccountId: randomUUID(), amount: 10 });
      expect(none.status).toBe(404);
      expect(await saldo(B.accounts[0].id)).toBe(300);
      expect(await saldo(A.accounts[0].id)).toBe(1000);
    });

    it('limite por operacion', async () => {
      const big = await makeActor([{ saldo: '90000.00' }, { saldo: '0.00' }]);
      const r = await internal(big, { sourceAccountId: big.accounts[0].id, destinationAccountId: big.accounts[1].id, amount: 20000.01 });
      expect(r.body.error).toBe('TRANSFER_LIMIT_EXCEEDED');
    });

    it('limite diario acumulado', async () => {
      const big = await makeActor([{ saldo: '90000.00' }, { saldo: '0.00' }]);
      const body = { sourceAccountId: big.accounts[0].id, destinationAccountId: big.accounts[1].id, amount: 20000 };
      expect((await internal(big, body)).status).toBe(201);
      expect((await internal(big, body)).status).toBe(201);
      const third = await internal(big, body);
      expect(third.status).toBe(422);
      expect(third.body.error).toBe('DAILY_LIMIT_EXCEEDED');
    });

    it('idempotencia: misma clave en serie = un solo debito', async () => {
      const key = randomUUID();
      const body = { sourceAccountId: A.accounts[0].id, destinationAccountId: A.accounts[1].id, amount: 100 };
      const r1 = await internal(A, body, key);
      const r2 = await internal(A, body, key);
      expect(r2.status).toBe(201);
      expect(r2.body.transferId).toBe(r1.body.transferId);
      expect(await saldo(A.accounts[0].id)).toBe(900);
      expect(await prisma.transferencia_internas.count({ where: { id_cuenta_origen: A.accounts[0].id } })).toBe(1);
    });

    it('idempotencia: 10 requests concurrentes con la misma clave = un solo debito', async () => {
      const key = randomUUID();
      const body = { sourceAccountId: A.accounts[0].id, destinationAccountId: A.accounts[1].id, amount: 100 };
      const rs = await Promise.all(Array.from({ length: 10 }, () => internal(A, body, key)));
      expect(rs.every((r) => r.status === 201)).toBe(true);
      expect(new Set(rs.map((r) => r.body.transferId)).size).toBe(1);
      expect(await saldo(A.accounts[0].id)).toBe(900);
      expect(await saldo(A.accounts[1].id)).toBe(600);
    });

    it('misma clave con otro monto -> 422 y sin efecto', async () => {
      const key = randomUUID();
      await internal(A, { sourceAccountId: A.accounts[0].id, destinationAccountId: A.accounts[1].id, amount: 100 }, key);
      const r = await internal(A, { sourceAccountId: A.accounts[0].id, destinationAccountId: A.accounts[1].id, amount: 200 }, key);
      expect(r.status).toBe(422);
      expect(await saldo(A.accounts[0].id)).toBe(900);
    });

    it('sin Idempotency-Key -> 400', async () => {
      const r = await http().post('/api/transactions/internal').set(auth(A)).send({
        sourceAccountId: A.accounts[0].id,
        destinationAccountId: A.accounts[1].id,
        amount: 1,
      });
      expect(r.status).toBe(400);
    });

    it('concurrencia: 10 transferencias distintas de 300 sobre saldo 1000 -> nunca sobregira (3 exitosas)', async () => {
      const rs = await Promise.all(
        Array.from({ length: 10 }, () =>
          internal(A, { sourceAccountId: A.accounts[0].id, destinationAccountId: A.accounts[1].id, amount: 300 }),
        ),
      );
      expect(rs.filter((r) => r.status === 201).length).toBe(3);
      expect(rs.filter((r) => r.status === 422).every((r) => r.body.error === 'INSUFFICIENT_FUNDS')).toBe(true);
      expect(await saldo(A.accounts[0].id)).toBe(100);
      expect(await saldo(A.accounts[1].id)).toBe(1400);
    });

    it('concurrencia cruzada A->B y B->A no genera deadlock y conserva el total', async () => {
      const reqs = [];
      for (let i = 0; i < 10; i++) {
        reqs.push(internal(A, { sourceAccountId: A.accounts[0].id, destinationAccountId: A.accounts[1].id, amount: 10 }));
        reqs.push(internal(A, { sourceAccountId: A.accounts[1].id, destinationAccountId: A.accounts[0].id, amount: 10 }));
      }
      const rs = await Promise.all(reqs);
      expect(rs.every((r) => r.status === 201)).toBe(true);
      expect((await saldo(A.accounts[0].id)) + (await saldo(A.accounts[1].id))).toBe(1500);
    });

    it('rollback: un fallo a mitad de la transaccion no deja origen debitado ni registros', async () => {
      await prisma.$executeRawUnsafe(`
        CREATE OR REPLACE FUNCTION test_falla_credito() RETURNS TRIGGER AS $$
        BEGIN
          IF NEW.tipo = 'CREDITO' AND NEW.descripcion = 'FALLA_TEST' THEN RAISE EXCEPTION 'falla simulada'; END IF;
          RETURN NEW;
        END; $$ LANGUAGE plpgsql`);
      await prisma.$executeRawUnsafe(
        `CREATE TRIGGER t_test_falla BEFORE INSERT ON movimiento FOR EACH ROW EXECUTE FUNCTION test_falla_credito()`,
      );
      try {
        const key = randomUUID();
        const r = await internal(
          A,
          { sourceAccountId: A.accounts[0].id, destinationAccountId: A.accounts[1].id, amount: 100, description: 'FALLA_TEST' },
          key,
        );
        expect(r.status).toBe(500);
        expect(JSON.stringify(r.body)).not.toMatch(/falla|SELECT|INSERT|prisma/i);
        expect(await saldo(A.accounts[0].id)).toBe(1000);
        expect(await saldo(A.accounts[1].id)).toBe(500);
        expect(await prisma.transferencia_internas.count({ where: { id_cuenta_origen: A.accounts[0].id } })).toBe(0);
        expect(await prisma.movimiento.count({ where: { id_cuenta: A.accounts[0].id } })).toBe(0);
        // la clave tambien se revirtio: tras corregir la causa, el reintento procede
        expect(await prisma.idempotencia.count({ where: { id_cliente: A.id, clave: key } })).toBe(0);
      } finally {
        await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS t_test_falla ON movimiento`);
        await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS test_falla_credito()`);
      }
    });

    it('contrato previo POST /transactions (internal) funciona', async () => {
      const r = await http()
        .post('/api/transactions')
        .set(auth(A))
        .set('Idempotency-Key', randomUUID())
        .send({ transactionType: 'internal', sourceAccountId: A.accounts[0].id, destinationAccount: A.accounts[1].id, amount: 10 });
      expect(r.status).toBe(201);
      expect(r.body.status).toBe('success');
    });
  });

  describe('HU10/HU11/HU12 - terceros, recientes y constancia', () => {
    let A: Actor, B: Actor, C: Actor;
    beforeEach(async () => {
      A = await makeActor([{ saldo: '1000.00' }]);
      B = await makeActor([{ saldo: '300.00' }, { saldo: '5.00', moneda: 'USD' }]);
      C = await makeActor([{ saldo: '50.00' }]);
    });

    it('transfiere a un tercero: debita origen y acredita destino', async () => {
      const r = await thirdParty(A, { sourceAccountId: A.accounts[0].id, destinationCci: B.accounts[0].cci, amount: 125.25, description: 'Pago' });
      expect(r.status).toBe(201);
      expect(await saldo(A.accounts[0].id)).toBe(874.75);
      expect(await saldo(B.accounts[0].id)).toBe(425.25);
      const t = await prisma.transferencia_externa.findUnique({ where: { id: r.body.transferId } });
      expect(t.estado).toBe('COMPLETADO');
      expect(await prisma.movimiento.count({ where: { id_transferencia_externa: r.body.transferId } })).toBe(2);
    });

    it('destino inexistente, propio, moneda distinta, origen ajeno y saldo insuficiente', async () => {
      const none = await thirdParty(A, { sourceAccountId: A.accounts[0].id, destinationCci: '191-0000000000-00', amount: 10 });
      expect(none.status).toBe(404);
      expect(none.body.error).toBe('DESTINATION_NOT_FOUND');
      const own = await thirdParty(A, { sourceAccountId: A.accounts[0].id, destinationCci: A.accounts[0].cci, amount: 10 });
      expect(own.body.error).toBe('USE_OWN_TRANSFER');
      const cur = await thirdParty(A, { sourceAccountId: A.accounts[0].id, destinationCci: B.accounts[1].cci, amount: 10 });
      expect(cur.body.error).toBe('CURRENCY_MISMATCH');
      const foreign = await thirdParty(A, { sourceAccountId: C.accounts[0].id, destinationCci: B.accounts[0].cci, amount: 10 });
      expect(foreign.status).toBe(404);
      const ins = await thirdParty(A, { sourceAccountId: A.accounts[0].id, destinationCci: B.accounts[0].cci, amount: 5000 });
      expect(ins.body.error).toBe('INSUFFICIENT_FUNDS');
      expect(await saldo(C.accounts[0].id)).toBe(50);
    });

    it('idempotencia concurrente en terceros: un solo debito/credito', async () => {
      const key = randomUUID();
      const body = { sourceAccountId: A.accounts[0].id, destinationCci: B.accounts[0].cci, amount: 100 };
      const rs = await Promise.all(Array.from({ length: 8 }, () => thirdParty(A, body, key)));
      expect(rs.every((r) => r.status === 201)).toBe(true);
      expect(new Set(rs.map((r) => r.body.transferId)).size).toBe(1);
      expect(await saldo(A.accounts[0].id)).toBe(900);
      expect(await saldo(B.accounts[0].id)).toBe(400);
    });

    it('HU11: recientes sin duplicados, ordenados por ultimo uso, solo del cliente autenticado', async () => {
      const toB = { sourceAccountId: A.accounts[0].id, destinationCci: B.accounts[0].cci, amount: 10 };
      const toC = { sourceAccountId: A.accounts[0].id, destinationCci: C.accounts[0].cci, amount: 10 };
      await thirdParty(A, toB);
      await thirdParty(A, toC);
      await thirdParty(A, toB); // B vuelve a ser el mas reciente
      const r = await http().get('/api/transactions/recent-recipients').set(auth(A));
      expect(r.status).toBe(200);
      expect(r.body.items.length).toBe(2);
      expect(r.body.items[0].timesUsed).toBe(2);
      expect(r.body.items[0].maskedNumber).toBe(`****${B.accounts[0].cci.replace(/\D/g, '').slice(-4)}`);
      expect(r.body.items[0].holder).toMatch(/^Cliente \d?\.?/);
      expect(r.body.items[0].holder).not.toContain('Prueba');
      const limited = await http().get('/api/transactions/recent-recipients?limit=1').set(auth(A));
      expect(limited.body.items.length).toBe(1);
      // B no ve los destinatarios de A
      const other = await http().get('/api/transactions/recent-recipients').set(auth(B));
      expect(other.body.items).toEqual([]);
    });

    it('HU12: constancia solo para el ordenante; datos enmascarados y desde la BD', async () => {
      const t = await thirdParty(A, { sourceAccountId: A.accounts[0].id, destinationCci: B.accounts[0].cci, amount: 33.3, description: 'Alquiler' });
      const ok = await http().get(`/api/transactions/${t.body.transferId}/receipt`).set(auth(A));
      expect(ok.status).toBe(200);
      expect(ok.headers['cache-control']).toBe('no-store');
      expect(ok.body).toMatchObject({
        operationId: t.body.transferId,
        amount: '33.30',
        currency: 'PEN',
        status: 'COMPLETADO',
        description: 'Alquiler',
      });
      expect(ok.body.source.maskedNumber).toMatch(/^\*{4}\d{4}$/);
      expect(ok.body.destination.maskedNumber).toMatch(/^\*{4}\d{4}$/);
      expect(JSON.stringify(ok.body)).not.toContain(B.accounts[0].cci);
      // otro cliente (incluido el receptor) no puede obtenerla
      expect((await http().get(`/api/transactions/${t.body.transferId}/receipt`).set(auth(C))).status).toBe(404);
      expect((await http().get(`/api/transactions/${t.body.transferId}/receipt`).set(auth(B))).status).toBe(404);
      expect((await http().get(`/api/transactions/${randomUUID()}/receipt`).set(auth(A))).status).toBe(404);
      expect((await http().get(`/api/transactions/abc/receipt`).set(auth(A))).status).toBe(404);
    });

    it('HU12: constancia de transferencia interna', async () => {
      const A2 = await makeActor([{ saldo: '100.00' }, { saldo: '0.00' }]);
      const t = await internal(A2, { sourceAccountId: A2.accounts[0].id, destinationAccountId: A2.accounts[1].id, amount: 10 });
      const r = await http().get(`/api/transactions/${t.body.transferId}/receipt`).set(auth(A2));
      expect(r.status).toBe(200);
      expect(r.body.type).toMatch(/propias/);
    });
  });

  describe('HU07/HU08 - movimientos, filtros y paginacion', () => {
    let A: Actor, B: Actor;
    beforeAll(async () => {
      A = await makeActor([{ saldo: '1000.00' }, { saldo: '0.00' }]);
      B = await makeActor([{ saldo: '100.00' }]);
      const rows = [
        { c: 0, tipo: 'DEBITO', monto: '10.00', d: 'Pago Luz del Sur', f: '2026-08-01T10:00:00Z' },
        { c: 0, tipo: 'DEBITO', monto: '50.00', d: 'Compra Amazon', f: '2026-08-15T10:00:00Z' },
        { c: 0, tipo: 'CREDITO', monto: '200.00', d: 'Nomina agosto', f: '2026-08-31T23:30:00Z' },
        { c: 0, tipo: 'CREDITO', monto: '75.50', d: 'Deposito 100% efectivo', f: '2026-09-10T10:00:00Z' },
        { c: 1, tipo: 'CREDITO', monto: '5.00', d: 'Otra cuenta', f: '2026-09-11T10:00:00Z' },
      ];
      for (const r of rows) {
        await prisma.movimiento.create({
          data: { id_cuenta: A.accounts[r.c].id, tipo: r.tipo, monto: r.monto, saldo_posterior: '1.00', descripcion: r.d, fecha: new Date(r.f) },
        });
      }
      await prisma.movimiento.create({
        data: { id_cuenta: B.accounts[0].id, tipo: 'CREDITO', monto: '999.00', saldo_posterior: '1.00', descripcion: 'Nomina de B', fecha: new Date('2026-08-20T10:00:00Z') },
      });
    });

    const q = (a: Actor, params: Record<string, any>) => http().get('/api/movements').query(params).set(auth(a));

    it('sin filtros: solo movimientos propios, ordenados por fecha desc', async () => {
      const r = await q(A, {});
      expect(r.body.total).toBe(5);
      const dates = r.body.items.map((i: any) => i.date);
      expect([...dates].sort().reverse()).toEqual(dates);
      expect(JSON.stringify(r.body)).not.toContain('Nomina de B');
    });

    it('orden ascendente', async () => {
      const r = await q(A, { order: 'asc' });
      expect(r.body.items[0].description).toBe('Pago Luz del Sur');
    });

    it('filtro por tipo, monto, cuenta y descripcion (con comodines escapados)', async () => {
      expect((await q(A, { type: 'CREDITO' })).body.total).toBe(3);
      expect((await q(A, { minAmount: 50, maxAmount: 200 })).body.total).toBe(3);
      expect((await q(A, { accountId: A.accounts[1].id })).body.total).toBe(1);
      expect((await q(A, { q: 'amazon' })).body.total).toBe(1);
      expect((await q(A, { q: '100%' })).body.total).toBe(1);
      expect((await q(A, { q: '%%' })).body.total).toBe(0);
    });

    it('rango de fechas inclusivo en ambos extremos', async () => {
      expect((await q(A, { from: '2026-08-01', to: '2026-08-31' })).body.total).toBe(3);
      expect((await q(A, { from: '2026-09-01' })).body.total).toBe(2);
      expect((await q(A, { to: '2026-08-01' })).body.total).toBe(1);
    });

    it('combinacion de filtros + paginacion', async () => {
      const r = await q(A, { accountId: A.accounts[0].id, type: 'DEBITO', from: '2026-08-01', to: '2026-09-30', pageSize: 1, page: 2 });
      expect(r.body.total).toBe(2);
      expect(r.body.totalPages).toBe(2);
      expect(r.body.items.length).toBe(1);
      expect(r.body.items[0].description).toBe('Pago Luz del Sur');
    });

    it('valida parametros', async () => {
      expect((await q(A, { from: '2026-09-02', to: '2026-09-01' })).status).toBe(400);
      expect((await q(A, { from: '01/09/2026' })).status).toBe(400);
      expect((await q(A, { minAmount: 10, maxAmount: 5 })).status).toBe(400);
      expect((await q(A, { type: 'OTRO' })).status).toBe(400);
      expect((await q(A, { pageSize: 1000 })).status).toBe(400);
      expect((await q(A, { page: 0 })).status).toBe(400);
      expect((await q(A, { q: 'a' })).status).toBe(400);
      expect((await q(A, { accountId: 'x' })).status).toBe(400);
    });

    it('HU07 detalle: movimientos paginados de la cuenta', async () => {
      const r = await http().get(`/api/accounts/${A.accounts[0].id}`).query({ pageSize: 2 }).set(auth(A));
      expect(r.body.movements.total).toBe(4);
      expect(r.body.movements.items.length).toBe(2);
      expect(r.body.movements.items[0].accountId).toBe(A.accounts[0].id);
    });

    it('contrato previo GET /accounts/movements es autenticado y por cliente', async () => {
      const r = await http().get('/api/accounts/movements').set(auth(B));
      expect(r.status).toBe(200);
      expect(r.body.length).toBe(1);
      expect(r.body[0].amount).toContain('+');
    });
  });

  describe('Auditoria (triggers + contexto de usuario)', () => {
    it('registra cambios de saldo con el usuario autenticado y sin secretos', async () => {
      const A = await makeActor([{ saldo: '100.00' }, { saldo: '0.00' }]);
      await internal(A, { sourceAccountId: A.accounts[0].id, destinationAccountId: A.accounts[1].id, amount: 10 });
      const logs = await prisma.audit_logs.findMany({
        where: { nombre_tabla: 'cuenta', usuario_app: A.email, operacion: 'UPDATE' },
      });
      expect(logs.length).toBeGreaterThanOrEqual(2);
      const cliLogs = await prisma.audit_logs.findMany({ where: { nombre_tabla: 'cliente' }, take: 50 });
      expect(JSON.stringify(cliLogs, (_k, v) => (typeof v === 'bigint' ? v.toString() : v))).not.toContain('password_hash');
    });
  });
});
