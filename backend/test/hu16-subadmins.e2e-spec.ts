import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const PASSWORD = 'Clave-Test-9';
const SUPER = 1; // ADMIN: todos los permisos
const SOPORTE = 2; // METRICAS_VER, CUENTAS_SUPERVISAR, CLIENTES_VER
const GESTOR_ID = 90; // rol de prueba: solo ADMINS_GESTIONAR
const GESTOR = 'GESTOR_ADMINS_TEST';

describe('Sprint 3 - HU16 subadministradores, permisos y auditoria (PostgreSQL real)', () => {
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

  async function makeAdmin(roleIds: number[]): Promise<Actor> {
    const email = `adm${uniq()}@test.local`;
    const a = await prisma.admin.create({
      data: { nombre_usuario: `Admin ${uniq()}`, correo: email, password_hash: bcrypt.hashSync(PASSWORD, 4) },
    });
    for (const id_rol of roleIds) await prisma.admin_rol.create({ data: { id_admin: a.id, id_rol } });
    return { id: a.id, email, token: await login(email) };
  }

  async function makeClient(rol: 'CLIENTE' | 'ADMIN' = 'CLIENTE'): Promise<Actor> {
    const n = uniq();
    const email = `c${n}@test.local`;
    const c = await prisma.cliente.create({
      data: { dni: n, nombres: `Cli${n}`, apellidos: 'T', correo: email, rol, password_hash: bcrypt.hashSync(PASSWORD, 4) },
    });
    return { id: c.id, email, token: await login(email) };
  }

  const newSubadmin = (overrides: Record<string, unknown> = {}) => ({
    name: 'Marta Soporte',
    email: `sub${uniq()}@test.local`,
    password: 'ClaveSegura123',
    roles: ['SOPORTE'],
    ...overrides,
  });
  const create = (a: Actor, body: unknown) => http().post('/api/admin/subadmins').set(auth(a)).send(body as object);
  const changeRoles = (a: Actor, id: string, roles: unknown) =>
    http().patch(`/api/admin/subadmins/${id}/roles`).set(auth(a)).send({ roles });

  const audits = (actorId: string) => prisma.auditoria_admin.findMany({ where: { id_actor: actorId }, orderBy: { id: 'desc' } });
  async function eventually<T>(fn: () => Promise<T>, ok: (v: T) => boolean): Promise<T> {
    let v = await fn();
    for (let i = 0; i < 20 && !ok(v); i++) {
      await new Promise((r) => setTimeout(r, 100));
      v = await fn();
    }
    return v;
  }

  let SUPERADMIN: Actor;
  let GESTOR_ACTOR: Actor;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);

    // Rol delegado: puede gestionar administradores pero no tiene ningun otro permiso.
    await prisma.rol.upsert({
      where: { id: GESTOR_ID },
      update: {},
      create: { id: GESTOR_ID, nombre: GESTOR, descripcion: 'Solo pruebas' },
    });
    await prisma.rol_permiso.createMany({ data: [{ id_rol: GESTOR_ID, id_permiso: 5 }], skipDuplicates: true });

    SUPERADMIN = await makeAdmin([SUPER]);
    GESTOR_ACTOR = await makeAdmin([GESTOR_ID]);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('modelo de roles y permisos (DB)', () => {
    it('permisos sembrados y asignados: ADMIN tiene todos; SOPORTE solo lectura', async () => {
      const rows = await prisma.$queryRaw<{ rol: string; codigo: string }[]>`
        SELECT r.nombre AS rol, p.codigo FROM rol_permiso rp JOIN rol r ON r.id = rp.id_rol JOIN permiso p ON p.id = rp.id_permiso
        WHERE r.id IN (1, 2)`;
      const of = (rol: string) => rows.filter((r) => r.rol === rol).map((r) => r.codigo).sort();
      expect(of('ADMIN')).toEqual(['ADMINS_GESTIONAR', 'CLIENTES_GESTIONAR', 'CLIENTES_VER', 'CUENTAS_SUPERVISAR', 'METRICAS_VER']);
      expect(of('SOPORTE')).toEqual(['CLIENTES_VER', 'CUENTAS_SUPERVISAR', 'METRICAS_VER']);
    });

    it('integridad: no se duplican asignaciones ni se asigna un permiso inexistente', async () => {
      await expect(prisma.rol_permiso.create({ data: { id_rol: 1, id_permiso: 1 } })).rejects.toBeDefined();
      await expect(prisma.rol_permiso.create({ data: { id_rol: 1, id_permiso: 999 } })).rejects.toBeDefined();
      const adm = await makeAdmin([SOPORTE]);
      await expect(prisma.admin_rol.create({ data: { id_admin: adm.id, id_rol: SOPORTE } })).rejects.toBeDefined();
    });

    it('la bitacora auditoria_admin es de solo insercion', async () => {
      await create(SUPERADMIN, newSubadmin());
      const [last] = await audits(SUPERADMIN.id);
      await expect(
        prisma.$executeRaw`UPDATE auditoria_admin SET resultado = 'ERROR' WHERE id = ${last.id}`,
      ).rejects.toBeDefined();
      await expect(prisma.$executeRaw`DELETE FROM auditoria_admin WHERE id = ${last.id}`).rejects.toBeDefined();
    });
  });

  describe('registro de subadministradores', () => {
    it('crea con roles, sin exponer credenciales, con hash y trazabilidad del creador', async () => {
      const body = newSubadmin();
      const res = await create(SUPERADMIN, body);
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        name: 'Marta Soporte',
        email: body.email,
        status: 'active',
        roles: ['SOPORTE'],
        permissions: ['CLIENTES_VER', 'CUENTAS_SUPERVISAR', 'METRICAS_VER'],
      });
      const raw = JSON.stringify(res.body).toLowerCase();
      expect(raw).not.toContain('password');
      expect(raw).not.toContain('hash');

      const row = await prisma.admin.findUnique({ where: { id: res.body.id } });
      expect(row.password_hash).not.toBe(body.password);
      expect(row.password_hash.startsWith('$2')).toBe(true);
      expect(row.id_creador).toBe(SUPERADMIN.id);
      expect(await prisma.admin_rol.count({ where: { id_admin: res.body.id } })).toBe(1);
    });

    it('el nuevo subadmin inicia sesion con sus credenciales', async () => {
      const body = newSubadmin();
      expect((await create(SUPERADMIN, body)).status).toBe(201);
      expect(await login(body.email, body.password)).toBeTruthy();
    });

    it('identidad unica: correo repetido (sin distinguir mayusculas), de otro admin o de un cliente -> 409', async () => {
      const body = newSubadmin();
      expect((await create(SUPERADMIN, body)).status).toBe(201);
      const dup = await create(SUPERADMIN, { ...body, email: body.email.toUpperCase() });
      expect(dup.status).toBe(409);
      expect(dup.body.error).toBe('EMAIL_IN_USE');
      const client = await makeClient();
      expect((await create(SUPERADMIN, newSubadmin({ email: client.email }))).status).toBe(409);
    });

    it('altas simultaneas con el mismo correo: se crea una sola', async () => {
      const body = newSubadmin();
      const rs = await Promise.all(Array.from({ length: 5 }, () => create(SUPERADMIN, body)));
      expect(rs.filter((r) => r.status === 201)).toHaveLength(1);
      expect(rs.filter((r) => r.status === 409)).toHaveLength(4);
      expect(await prisma.admin.count({ where: { correo: body.email } })).toBe(1);
    });

    it('validaciones: campos obligatorios, formatos, longitudes, roles y campos extra', async () => {
      const bad: Record<string, unknown>[] = [
        { name: '' },
        { name: 'A' },
        { name: 'Robert<script>' },
        { name: 'x'.repeat(101) },
        { email: 'no-es-correo' },
        { email: undefined },
        { password: 'corta1' },
        { password: 'sololetrassinnumero' },
        { password: undefined },
        { roles: [] },
        { roles: 'SOPORTE' },
        { roles: ['SOPORTE', 'SOPORTE'] },
        { roles: ['soporte'] },
        { roles: ['../ADMIN'] },
        { roles: ['A', 'B', 'C', 'D', 'E', 'F'] },
        { permissions: ['ADMINS_GESTIONAR'] }, // los privilegios solo se asignan por rol
        { role: 'ADMIN' },
      ];
      for (const override of bad) {
        const res = await create(SUPERADMIN, newSubadmin(override));
        expect({ override, status: res.status }).toEqual({ override, status: 400 });
      }
      const unknown = await create(SUPERADMIN, newSubadmin({ roles: ['NO_EXISTE'] }));
      expect(unknown.status).toBe(422);
      expect(unknown.body.error).toBe('ROLE_NOT_FOUND');
    });

    it('un rechazo no deja datos a medias', async () => {
      const email = `parcial${uniq()}@test.local`;
      expect((await create(SUPERADMIN, newSubadmin({ email, roles: ['NO_EXISTE'] }))).status).toBe(422);
      expect(await prisma.admin.count({ where: { correo: email } })).toBe(0);
    });
  });

  describe('control de acceso basado en permisos', () => {
    let SUPPORT: Actor;
    beforeAll(async () => {
      const body = newSubadmin();
      expect((await create(SUPERADMIN, body)).status).toBe(201);
      SUPPORT = { id: '', email: body.email, token: await login(body.email, body.password) };
      SUPPORT.id = (await prisma.admin.findFirst({ where: { correo: body.email } })).id;
    });

    it('sin token 401; cliente 403; token firmado ajeno 401', async () => {
      const client = await makeClient();
      for (const path of ['/api/admin/metrics', '/api/admin/accounts', '/api/admin/subadmins', '/api/users']) {
        expect((await http().get(path)).status).toBe(401);
        expect((await http().get(path).set(auth(client))).status).toBe(403);
      }
    });

    it('SOPORTE puede lo que sus permisos permiten y nada mas', async () => {
      for (const path of ['/api/admin/metrics', '/api/admin/accounts', '/api/users']) {
        expect((await http().get(path).set(auth(SUPPORT))).status).toBe(200);
      }
      const victim = await makeClient();
      expect((await http().post('/api/users').set(auth(SUPPORT)).send({ name: 'X', email: `x${uniq()}@t.com`, role: 'client' })).status).toBe(403);
      expect((await http().patch(`/api/users/${victim.id}`).set(auth(SUPPORT)).send({ name: 'Y' })).status).toBe(403);
      expect((await http().delete(`/api/users/${victim.id}`).set(auth(SUPPORT))).status).toBe(403);
      expect((await http().get('/api/admin/subadmins').set(auth(SUPPORT))).status).toBe(403);
      expect((await create(SUPPORT, newSubadmin())).status).toBe(403);
      expect(await prisma.cliente.count({ where: { id: victim.id } })).toBe(1);
    });

    it('administrador con rol ADMIN conserva acceso total', async () => {
      const victim = await makeClient();
      expect((await http().patch(`/api/users/${victim.id}`).set(auth(SUPERADMIN)).send({ name: 'Renombrado' })).status).toBe(200);
      expect((await http().get('/api/admin/subadmins').set(auth(SUPERADMIN))).status).toBe(200);
    });

    it('cliente con rol ADMIN heredado: opera como antes pero no gestiona administradores', async () => {
      const legacy = await makeClient('ADMIN');
      const victim = await makeClient();
      expect((await http().get('/api/admin/metrics').set(auth(legacy))).status).toBe(200);
      expect((await http().patch(`/api/users/${victim.id}`).set(auth(legacy)).send({ name: 'Ok' })).status).toBe(200);
      expect((await create(legacy, newSubadmin())).status).toBe(403);
      // No puede elevar a otro cliente a admin ni cambiarse a si mismo.
      const promote = await http().patch(`/api/users/${victim.id}`).set(auth(legacy)).send({ role: 'admin' });
      expect(promote.status).toBe(403);
      expect(promote.body.error).toBe('PRIVILEGE_ESCALATION');
      expect((await prisma.cliente.findUnique({ where: { id: victim.id } })).rol).toBe('CLIENTE');
      const self = await http().patch(`/api/users/${legacy.id}`).set(auth(legacy)).send({ status: 'inactive' });
      expect(self.status).toBe(403);
      expect(self.body.error).toBe('SELF_PRIVILEGE_CHANGE');
      // El panel reenvia role/status sin cambios: eso no es un cambio de privilegios.
      expect((await http().patch(`/api/users/${victim.id}`).set(auth(legacy)).send({ name: 'N2', role: 'client', status: 'active' })).status).toBe(200);
      expect((await http().delete(`/api/users/${legacy.id}`).set(auth(legacy))).status).toBe(403);
    });

    it('los permisos se leen de la BD en cada peticion: un cambio de roles aplica al instante con el mismo token', async () => {
      const body = newSubadmin();
      const created = await create(SUPERADMIN, body);
      const token = { Authorization: `Bearer ${await login(body.email, body.password)}` };
      expect((await http().get('/api/admin/metrics').set(token)).status).toBe(200);
      expect((await changeRoles(SUPERADMIN, created.body.id, [GESTOR])).status).toBe(200);
      expect((await http().get('/api/admin/metrics').set(token)).status).toBe(403);
      expect((await http().get('/api/admin/subadmins').set(token)).status).toBe(200);
    });

    it('un administrador desactivado pierde el acceso aunque conserve el token', async () => {
      const adm = await makeAdmin([SOPORTE]);
      expect((await http().get('/api/admin/metrics').set(auth(adm))).status).toBe(200);
      await prisma.admin.update({ where: { id: adm.id }, data: { estado: 'INACTIVO' } });
      expect((await http().get('/api/admin/metrics').set(auth(adm))).status).toBe(403);
    });
  });

  describe('restriccion de privilegios', () => {
    it('nadie asigna roles con permisos que no posee (crear)', async () => {
      // GESTOR solo tiene ADMINS_GESTIONAR: no puede crear un ADMIN ni un SOPORTE.
      for (const roles of [['ADMIN'], ['SOPORTE'], [GESTOR, 'SOPORTE']]) {
        const body = newSubadmin({ roles });
        const res = await create(GESTOR_ACTOR, body);
        expect(res.status).toBe(403);
        expect(res.body.error).toBe('PRIVILEGE_ESCALATION');
        expect(await prisma.admin.count({ where: { correo: body.email } })).toBe(0);
      }
      // Dentro de su propio alcance si puede delegar.
      const ok = await create(GESTOR_ACTOR, newSubadmin({ roles: [GESTOR] }));
      expect(ok.status).toBe(201);
      expect(ok.body.permissions).toEqual(['ADMINS_GESTIONAR']);
    });

    it('un administrador no puede modificar sus propios roles (403 y sin cambios)', async () => {
      const me = await makeAdmin([GESTOR_ID]);
      const res = await changeRoles(me, me.id, ['ADMIN']);
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('SELF_PRIVILEGE_CHANGE');
      expect(await prisma.admin_rol.findMany({ where: { id_admin: me.id } })).toHaveLength(1);
      expect((await http().get('/api/admin/metrics').set(auth(me))).status).toBe(403);
      // Ni siquiera el superadmin puede tocar los suyos.
      expect((await changeRoles(SUPERADMIN, SUPERADMIN.id, [GESTOR])).status).toBe(403);
    });

    it('sin ADMINS_GESTIONAR no hay forma de elevarse: ni por /admin/subadmins ni por /users', async () => {
      const body = newSubadmin();
      const created = await create(SUPERADMIN, body);
      const support: Actor = { id: created.body.id, email: body.email, token: await login(body.email, body.password) };
      expect((await changeRoles(support, support.id, ['ADMIN'])).status).toBe(403);
      expect((await http().patch(`/api/users/${support.id}`).set(auth(support)).send({ role: 'admin' })).status).toBe(403);
      expect((await http().post('/api/users').set(auth(support)).send({ name: 'X', email: `x${uniq()}@t.com`, role: 'admin' })).status).toBe(403);
      expect((await prisma.admin_rol.findMany({ where: { id_admin: support.id } })).map((r) => r.id_rol)).toEqual([SOPORTE]);
    });

    it('un gestor delegado no puede promover a otro ni tocar a quien tiene mas permisos que el', async () => {
      const subordinate = await create(SUPERADMIN, newSubadmin({ roles: [GESTOR] }));
      const promote = await changeRoles(GESTOR_ACTOR, subordinate.body.id, ['ADMIN']);
      expect(promote.status).toBe(403);
      expect(promote.body.error).toBe('PRIVILEGE_ESCALATION');

      const boss = await create(SUPERADMIN, newSubadmin({ roles: ['ADMIN'] }));
      const demote = await changeRoles(GESTOR_ACTOR, boss.body.id, [GESTOR]);
      expect(demote.status).toBe(403);
      expect((await prisma.admin_rol.findMany({ where: { id_admin: boss.body.id } })).map((r) => r.id_rol)).toEqual([SUPER]);
    });

    it('cambio de roles autorizado: reemplaza, devuelve el estado final y es atomico', async () => {
      const created = await create(SUPERADMIN, newSubadmin());
      const res = await changeRoles(SUPERADMIN, created.body.id, ['ADMIN', GESTOR]);
      expect(res.status).toBe(200);
      expect(res.body.roles).toEqual(['ADMIN', GESTOR]);
      expect(res.body.permissions).toContain('ADMINS_GESTIONAR');

      // Un rol inexistente en la lista no cambia nada.
      const bad = await changeRoles(SUPERADMIN, created.body.id, ['SOPORTE', 'NO_EXISTE']);
      expect(bad.status).toBe(422);
      expect((await prisma.admin_rol.findMany({ where: { id_admin: created.body.id } })).map((r) => r.id_rol).sort()).toEqual([SUPER, GESTOR_ID].sort());
    });

    it('id invalido o inexistente -> 404; cuerpo con "permissions" -> 400', async () => {
      for (const id of ['no-es-uuid', "' OR 1=1 --", '00000000-0000-0000-0000-000000000000']) {
        expect((await changeRoles(SUPERADMIN, encodeURIComponent(id), ['SOPORTE'])).status).toBe(404);
      }
      const created = await create(SUPERADMIN, newSubadmin());
      const res = await http().patch(`/api/admin/subadmins/${created.body.id}/roles`).set(auth(SUPERADMIN)).send({ roles: ['SOPORTE'], permissions: ['ADMINS_GESTIONAR'] });
      expect(res.status).toBe(400);
    });

    it('cambios simultaneos sobre el mismo objetivo se serializan y dejan un estado coherente', async () => {
      const created = await create(SUPERADMIN, newSubadmin());
      const rs = await Promise.all([
        changeRoles(SUPERADMIN, created.body.id, ['SOPORTE']),
        changeRoles(SUPERADMIN, created.body.id, [GESTOR]),
        changeRoles(SUPERADMIN, created.body.id, ['ADMIN']),
      ]);
      expect(rs.every((r) => r.status === 200)).toBe(true);
      const final = (await prisma.admin_rol.findMany({ where: { id_admin: created.body.id } })).map((r) => r.id_rol);
      expect(final).toHaveLength(1);
      expect([SOPORTE, GESTOR_ID, SUPER]).toContain(final[0]);
    });
  });

  describe('auditoria de acciones administrativas', () => {
    it('el alta registra actor, accion, objeto, resultado y fecha, sin credenciales', async () => {
      const body = newSubadmin();
      const res = await create(SUPERADMIN, body);
      const entry = (await audits(SUPERADMIN.id)).find((a) => a.accion === 'SUBADMIN_CREAR' && a.objeto_id === res.body.id);
      expect(entry).toBeDefined();
      expect(entry).toMatchObject({ id_actor: SUPERADMIN.id, objeto_tipo: 'ADMIN', resultado: 'EXITO' });
      expect(entry.fecha).toBeInstanceOf(Date);
      expect(entry.valor_nuevo).toMatchObject({ roles: ['SOPORTE'], estado: 'ACTIVO' });
      const raw = JSON.stringify(entry.valor_nuevo).toLowerCase() + JSON.stringify(entry.valor_anterior);
      for (const secret of [body.password.toLowerCase(), 'password', 'hash', body.email]) expect(raw).not.toContain(secret);
    });

    it('el cambio de roles guarda los valores anterior y posterior', async () => {
      const created = await create(SUPERADMIN, newSubadmin());
      expect((await changeRoles(SUPERADMIN, created.body.id, ['ADMIN'])).status).toBe(200);
      const entry = (await audits(SUPERADMIN.id)).find((a) => a.accion === 'SUBADMIN_ROLES_CAMBIAR' && a.objeto_id === created.body.id);
      expect(entry.resultado).toBe('EXITO');
      expect(entry.valor_anterior).toMatchObject({ roles: ['SOPORTE'], permissions: ['CLIENTES_VER', 'CUENTAS_SUPERVISAR', 'METRICAS_VER'] });
      expect(entry.valor_nuevo).toMatchObject({ roles: ['ADMIN'] });
      expect((entry.valor_nuevo as { permissions: string[] }).permissions).toContain('ADMINS_GESTIONAR');
    });

    it('los intentos de escalada y de auto-modificacion quedan registrados como DENEGADO', async () => {
      const created = await create(SUPERADMIN, newSubadmin({ roles: [GESTOR] }));
      await changeRoles(GESTOR_ACTOR, created.body.id, ['ADMIN']);
      await changeRoles(GESTOR_ACTOR, GESTOR_ACTOR.id, ['ADMIN']);
      await create(GESTOR_ACTOR, newSubadmin({ roles: ['ADMIN'] }));
      const log = await audits(GESTOR_ACTOR.id);
      expect(log.filter((a) => a.accion === 'SUBADMIN_ROLES_CAMBIAR' && a.objeto_id === created.body.id && a.resultado === 'DENEGADO').length).toBeGreaterThan(0);
      expect(log.filter((a) => a.accion === 'SUBADMIN_ROLES_CAMBIAR' && a.objeto_id === GESTOR_ACTOR.id && a.resultado === 'DENEGADO').length).toBeGreaterThan(0);
      expect(log.filter((a) => a.accion === 'SUBADMIN_CREAR' && a.resultado === 'DENEGADO').length).toBeGreaterThan(0);
    });

    it('un acceso sin permiso de personal administrativo se registra; el de un cliente corriente no', async () => {
      const support = await makeAdmin([SOPORTE]);
      expect((await create(support, newSubadmin())).status).toBe(403);
      const log = await eventually(() => audits(support.id), (l) => l.length > 0);
      expect(log[0]).toMatchObject({ accion: 'ACCESO_DENEGADO', resultado: 'DENEGADO', objeto_tipo: 'ENDPOINT' });

      const client = await makeClient();
      await http().get('/api/admin/metrics').set(auth(client));
      expect(await audits(client.id)).toHaveLength(0);
    });

    it('la gestion de clientes tambien queda auditada (sin cuerpos ni datos personales)', async () => {
      const email = `aud${uniq()}@test.local`;
      const res = await http().post('/api/users').set(auth(SUPERADMIN)).send({ name: 'Cliente Auditado', email, role: 'client' });
      expect(res.status).toBe(201);
      const log = await eventually(() => audits(SUPERADMIN.id), (l) => l.some((a) => a.accion === 'CLIENTE_CREAR' && a.objeto_id === res.body.id));
      const entry = log.find((a) => a.accion === 'CLIENTE_CREAR' && a.objeto_id === res.body.id);
      expect(entry).toMatchObject({ resultado: 'EXITO', objeto_tipo: 'CLIENTE' });
      expect(JSON.stringify(entry, (_k, v) => (typeof v === 'bigint' ? v.toString() : v))).not.toContain(email);

      const bad = await http().patch(`/api/users/${res.body.id}`).set(auth(SUPERADMIN)).send({ email: 'no-valido' });
      expect(bad.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('accesos efectivos y roles asignables (interfaz de gestion)', () => {
    it('GET /admin/access devuelve los roles y permisos reales de quien consulta', async () => {
      const full = await http().get('/api/admin/access').set(auth(SUPERADMIN));
      expect(full.status).toBe(200);
      expect(full.body.roles).toEqual(['ADMIN']);
      expect(full.body.permissions).toEqual(['ADMINS_GESTIONAR', 'CLIENTES_GESTIONAR', 'CLIENTES_VER', 'CUENTAS_SUPERVISAR', 'METRICAS_VER']);

      const support = await makeAdmin([SOPORTE]);
      const limited = await http().get('/api/admin/access').set(auth(support));
      expect(limited.body).toEqual({ roles: ['SOPORTE'], permissions: ['CLIENTES_VER', 'CUENTAS_SUPERVISAR', 'METRICAS_VER'] });

      const legacy = await makeClient('ADMIN');
      const legacyAccess = await http().get('/api/admin/access').set(auth(legacy));
      expect(legacyAccess.body.permissions).not.toContain('ADMINS_GESTIONAR');
    });

    it('GET /admin/access exige autenticacion y rol administrativo', async () => {
      const client = await makeClient();
      expect((await http().get('/api/admin/access')).status).toBe(401);
      expect((await http().get('/api/admin/access').set(auth(client))).status).toBe(403);
    });

    it('los permisos reflejan un cambio de roles al instante', async () => {
      const sub = await makeAdmin([SOPORTE]);
      expect((await changeRoles(SUPERADMIN, sub.id, [GESTOR])).status).toBe(200);
      expect((await http().get('/api/admin/access').set(auth(sub))).body.permissions).toEqual(['ADMINS_GESTIONAR']);
    });

    it('assignable-roles: ADMIN ve todos; un gestor delegado solo el rol que no supera sus permisos', async () => {
      const all = await http().get('/api/admin/subadmins/assignable-roles').set(auth(SUPERADMIN));
      expect(all.status).toBe(200);
      const names = all.body.map((r: { name: string }) => r.name);
      expect(names).toEqual(expect.arrayContaining(['ADMIN', 'SOPORTE', GESTOR]));
      const soporte = all.body.find((r: { name: string }) => r.name === 'SOPORTE');
      expect(soporte.permissions).toEqual(['CLIENTES_VER', 'CUENTAS_SUPERVISAR', 'METRICAS_VER']);

      const delegated = await http().get('/api/admin/subadmins/assignable-roles').set(auth(GESTOR_ACTOR));
      expect(delegated.body.map((r: { name: string }) => r.name)).toEqual([GESTOR]);
    });

    it('assignable-roles exige ADMINS_GESTIONAR (SOPORTE y clientes -> 403)', async () => {
      const support = await makeAdmin([SOPORTE]);
      const client = await makeClient();
      expect((await http().get('/api/admin/subadmins/assignable-roles').set(auth(support))).status).toBe(403);
      expect((await http().get('/api/admin/subadmins/assignable-roles').set(auth(client))).status).toBe(403);
      expect((await http().get('/api/admin/subadmins/assignable-roles')).status).toBe(401);
    });

    it('todo rol listado como asignable realmente se puede asignar (coherencia con la regla de escalada)', async () => {
      const roles = (await http().get('/api/admin/subadmins/assignable-roles').set(auth(GESTOR_ACTOR))).body.map((r: { name: string }) => r.name);
      for (const role of roles) {
        expect((await create(GESTOR_ACTOR, newSubadmin({ roles: [role] }))).status).toBe(201);
      }
    });
  });
});
