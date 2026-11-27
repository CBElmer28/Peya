import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const PASSWORD = 'ClaveSegura123!';
const SUPER_ROLE = 1;
const GHOST_UUID = '00000000-0000-4000-8000-00000000ffff'; // UUID valido que no existe

describe('Sprint 3 - QA complementario (SCRUM-77, SCRUM-83, SCRUM-90)', () => {
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
  const auth = (a: { token: string }) => ({ Authorization: `Bearer ${a.token}` });
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  async function login(email: string): Promise<string> {
    const res = await http().post('/api/auth/login').send({ email, password: PASSWORD });
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

  async function makeClient(): Promise<Actor & { dni: string }> {
    const n = uniq();
    const email = `cli${n}@test.local`;
    const c = await prisma.cliente.create({
      data: {
        dni: n,
        nombres: `Cliente ${n}`,
        apellidos: 'QA',
        correo: email,
        telefono: '987654321',
        password_hash: bcrypt.hashSync(PASSWORD, 4),
        estado: 'ACTIVO',
        rol: 'CLIENTE',
      },
    });
    return { id: c.id, email, dni: c.dni, token: await login(email) };
  }

  async function createAccount(clienteId: string, balance: number): Promise<{ id: string }> {
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

  // ---------------------------------------------------------------------------------------------
  describe('SCRUM-90 - QA bloqueo, desbloqueo y control de acceso', () => {
    it('concurrencia: dos bloqueos simultáneos → uno gana (201) y otro recibe conflicto (409)', async () => {
      const admin = await makeAdmin();
      const client = await makeClient();

      const responses = await Promise.all(
        [1, 2].map(() => http().post(`/api/users/${client.id}/block`).set(auth(admin)).send({ reason: 'Carrera' })),
      );
      expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);

      const db = await prisma.cliente.findUnique({ where: { id: client.id } });
      expect(db?.estado).toBe('INACTIVO');
      const abiertas = await prisma.sesion.count({ where: { id_cliente: client.id, estado_sesion: 'ACTIVA' } });
      expect(abiertas).toBe(0);
    });

    it('sesiones activas: con dos sesiones abiertas, el bloqueo invalida ambas al instante', async () => {
      const admin = await makeAdmin();
      const client = await makeClient();
      const segundoToken = await login(client.email);

      expect((await http().get('/api/users/me').set(auth(client))).status).toBe(200);
      expect((await http().get('/api/users/me').set({ Authorization: `Bearer ${segundoToken}` })).status).toBe(200);

      await http().post(`/api/users/${client.id}/block`).set(auth(admin)).send({});

      expect((await http().get('/api/users/me').set(auth(client))).status).toBe(401);
      expect((await http().get('/api/users/me').set({ Authorization: `Bearer ${segundoToken}` })).status).toBe(401);
      expect(await prisma.sesion.count({ where: { id_cliente: client.id, estado_sesion: 'ACTIVA' } })).toBe(0);
    });

    it('transiciones inválidas: desbloquear a un activo → 409; usuario inexistente o id inválido → 404', async () => {
      const admin = await makeAdmin();
      const client = await makeClient();

      expect((await http().post(`/api/users/${client.id}/unblock`).set(auth(admin)).send({})).status).toBe(409);
      expect((await http().post(`/api/users/${GHOST_UUID}/block`).set(auth(admin)).send({})).status).toBe(404);
      expect((await http().post('/api/users/abc/block').set(auth(admin)).send({})).status).toBe(404);
    });

    it('auditoría: bloqueo y desbloqueo registran actor, estado anterior y nuevo; el intento fallido queda como ERROR', async () => {
      const admin = await makeAdmin();
      const client = await makeClient();

      await http().post(`/api/users/${client.id}/block`).set(auth(admin)).send({ reason: 'Motivo QA' });
      await http().post(`/api/users/${client.id}/block`).set(auth(admin)).send({}); // 409
      await http().post(`/api/users/${client.id}/unblock`).set(auth(admin)).send({});
      await sleep(400); // la auditoria del interceptor se escribe despues de responder

      const bloqueos = await prisma.auditoria_admin.findMany({
        where: { accion: 'CLIENTE_BLOQUEAR', objeto_id: client.id },
      });
      expect(bloqueos.every((r) => r.id_actor === admin.id)).toBe(true);
      expect(
        bloqueos.some(
          (r) =>
            r.resultado === 'EXITO' &&
            (r.valor_anterior as any)?.estado === 'ACTIVO' &&
            (r.valor_nuevo as any)?.estado === 'INACTIVO',
        ),
      ).toBe(true);
      expect(bloqueos.some((r) => r.resultado === 'ERROR')).toBe(true);

      const desbloqueos = await prisma.auditoria_admin.findMany({
        where: { accion: 'CLIENTE_DESBLOQUEAR', objeto_id: client.id },
      });
      expect(
        desbloqueos.some(
          (r) =>
            r.resultado === 'EXITO' &&
            (r.valor_anterior as any)?.estado === 'INACTIVO' &&
            (r.valor_nuevo as any)?.estado === 'ACTIVO',
        ),
      ).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------------------------
  describe('SCRUM-77 - QA gestión de clientes (datos inválidos y campos críticos)', () => {
    it('datos inválidos al editar → 400 y el registro no cambia', async () => {
      const admin = await makeAdmin();
      const client = await makeClient();
      const patch = (body: object) => http().patch(`/api/users/${client.id}`).set(auth(admin)).send(body);

      expect((await patch({ email: 'no-es-un-correo' })).status).toBe(400);
      expect((await patch({ phone: '123' })).status).toBe(400);
      expect((await patch({ role: 'superusuario' })).status).toBe(400);
      expect((await patch({ status: 'borrado' })).status).toBe(400);

      const db = await prisma.cliente.findUnique({ where: { id: client.id } });
      expect(db?.correo).toBe(client.email);
      expect(db?.telefono).toBe('987654321');
      expect(db?.rol).toBe('CLIENTE');
      expect(db?.estado).toBe('ACTIVO');
    });

    it('cliente inexistente o id inválido → 404 (no 500)', async () => {
      const admin = await makeAdmin();
      expect((await http().get(`/api/users/${GHOST_UUID}`).set(auth(admin))).status).toBe(404);
      expect((await http().get('/api/users/abc').set(auth(admin))).status).toBe(404);
      expect((await http().patch(`/api/users/${GHOST_UUID}`).set(auth(admin)).send({ name: 'X' })).status).toBe(404);
      expect((await http().patch('/api/users/abc').set(auth(admin)).send({ name: 'X' })).status).toBe(404);
    });

    it('campos críticos (DNI, contraseña) no se pueden modificar desde la edición', async () => {
      const admin = await makeAdmin();
      const client = await makeClient();
      const antes = await prisma.cliente.findUnique({ where: { id: client.id } });

      const res = await http()
        .patch(`/api/users/${client.id}`)
        .set(auth(admin))
        .send({ name: 'Nombre Nuevo', dni: '00000000', password_hash: 'hack', passwordHash: 'hack' });
      expect(res.status).toBe(200);

      const despues = await prisma.cliente.findUnique({ where: { id: client.id } });
      expect(despues?.nombres).toBe('Nombre Nuevo');
      expect(despues?.dni).toBe(antes?.dni);
      expect(despues?.password_hash).toBe(antes?.password_hash);
    });

    it('integridad: no se elimina un cliente con cuentas (409) y sigue existiendo', async () => {
      const admin = await makeAdmin();
      const client = await makeClient();
      await createAccount(client.id, 50);

      expect((await http().delete(`/api/users/${client.id}`).set(auth(admin))).status).toBe(409);
      expect(await prisma.cliente.findUnique({ where: { id: client.id } })).not.toBeNull();
    });

    it('trazabilidad: toda modificación deja registro con actor y valores anterior/nuevo', async () => {
      const admin = await makeAdmin();
      const client = await makeClient();
      const res = await http()
        .patch(`/api/users/${client.id}`)
        .set(auth(admin))
        .send({ phone: '911222333', reason: 'Cambio solicitado por el titular' });
      expect(res.status).toBe(200);
      await sleep(400); // el registro del interceptor se escribe después de responder

      const registros = await prisma.auditoria_admin.findMany({
        where: { accion: 'CLIENTE_ACTUALIZAR', objeto_id: client.id, id_actor: admin.id, resultado: 'EXITO' },
      });
      expect(registros.length).toBeGreaterThanOrEqual(1);

      // Al menos un registro trae el detalle del cambio (valor anterior y nuevo)
      const detallado = registros.find((r) => (r.valor_nuevo as any)?.telefono !== undefined);
      expect(detallado).toBeDefined();
      expect((detallado!.valor_anterior as any)?.telefono).toBe('987654321');
      expect((detallado!.valor_nuevo as any)?.telefono).toBe('911222333');
    });

  });

  // ---------------------------------------------------------------------------------------------
  describe('SCRUM-83 - Consistencia e integridad de las consultas de operaciones', () => {
    it('la paginación no repite ni pierde registros y coincide con la base de datos', async () => {
      const admin = await makeAdmin();
      const client = await makeClient();
      const acc = await createAccount(client.id, 300);

      const montos = [10, 20, 30, 40, 50, 60, 70];
      for (const amount of montos) {
        const r = await http().post(`/api/accounts/${acc.id}/recharge`).set(auth(admin)).send({ amount, description: `Rec ${amount}` });
        expect(r.status).toBe(201);
      }

      const pageSize = 3;
      const todos: any[] = [];
      let total = -1;
      let totalPages = -1;
      for (let page = 1; page <= 3; page++) {
        const res = await http().get(`/api/admin/operations?accountId=${acc.id}&page=${page}&pageSize=${pageSize}`).set(auth(admin));
        expect(res.status).toBe(200);
        total = res.body.total;
        totalPages = res.body.totalPages;
        todos.push(...res.body.items);
      }

      expect(total).toBe(montos.length);
      expect(totalPages).toBe(3);
      expect(todos.length).toBe(montos.length);
      expect(new Set(todos.map((o) => o.id)).size).toBe(montos.length); // sin repetidos

      // Orden estable: fecha descendente a traves de todas las paginas
      const fechas = todos.map((o) => o.date);
      expect([...fechas].sort().reverse()).toEqual(fechas);

      // Lo mostrado coincide con lo almacenado
      const filas = await prisma.movimiento.findMany({ where: { id_cuenta: acc.id } });
      expect(filas.length).toBe(montos.length);
      const porId = new Map(filas.map((f) => [f.id, f]));
      for (const op of todos) {
        const f = porId.get(op.id);
        expect(f).toBeDefined();
        expect(op.numericAmount).toBe(Number(f!.monto));
        expect(op.numericBalanceAfter).toBe(Number(f!.saldo_posterior));
        expect(op.type).toBe(f!.tipo);
        expect(op.description).toBe(f!.descripcion);
      }

      // Una pagina mas alla del final no inventa datos
      const vacia = await http().get(`/api/admin/operations?accountId=${acc.id}&page=4&pageSize=${pageSize}`).set(auth(admin));
      expect(vacia.status).toBe(200);
      expect(vacia.body.items.length).toBe(0);
      expect(vacia.body.total).toBe(montos.length);
    });

    it('los filtros devuelven exactamente lo esperado (tipo, monto, fechas)', async () => {
      const admin = await makeAdmin();
      const client = await makeClient();
      const acc = await createAccount(client.id, 100);
      for (const amount of [10, 50, 90]) {
        await http().post(`/api/accounts/${acc.id}/recharge`).set(auth(admin)).send({ amount, description: `F ${amount}` });
      }
      const q = (qs: string) => http().get(`/api/admin/operations?accountId=${acc.id}&${qs}`).set(auth(admin));

      expect((await q('type=CREDITO')).body.total).toBe(3);
      expect((await q('type=DEBITO')).body.total).toBe(0);
      expect((await q('type=TODOS')).body.total).toBe(3);

      const rango = await q('minAmount=50&maxAmount=90'); // limites inclusivos
      expect(rango.body.items.map((o: any) => o.numericAmount).sort((a: number, b: number) => a - b)).toEqual([50, 90]);

      const dia = 24 * 3600 * 1000;
      const ayer = new Date(Date.now() - dia).toISOString().slice(0, 10);
      const manana = new Date(Date.now() + dia).toISOString().slice(0, 10);
      expect((await q(`from=${ayer}&to=${manana}`)).body.total).toBe(3);
      expect((await q(`from=${manana}`)).body.total).toBe(0);

      // Combinados = interseccion
      expect((await q('type=CREDITO&minAmount=40&from=' + ayer)).body.total).toBe(2);
    });

    it('integridad contable: el saldo de la cuenta coincide con el saldo posterior de su último movimiento', async () => {
      const admin = await makeAdmin();
      const client = await makeClient();
      const acc = await createAccount(client.id, 300);
      for (const amount of [15, 25]) {
        await http().post(`/api/accounts/${acc.id}/recharge`).set(auth(admin)).send({ amount, description: 'Int' });
      }

      const cuenta = await prisma.cuenta.findUnique({ where: { id: acc.id } });
      const ultimo = await prisma.movimiento.findFirst({
        where: { id_cuenta: acc.id },
        orderBy: [{ fecha: 'desc' }, { id: 'desc' }],
      });
      expect(Number(cuenta?.saldo)).toBe(340);
      expect(Number(ultimo?.saldo_posterior)).toBe(Number(cuenta?.saldo));
    });
  });
});