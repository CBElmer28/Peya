/* Datos DEMO para desarrollo (equivalentes a los antes cargados en memoria). Idempotente. */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const U = (n: number) => `00000000-0000-4000-8000-0000000000${String(n).padStart(2, '0')}`;
const A = (n: number) => `00000000-0000-4000-9000-0000000000${String(n).padStart(2, '0')}`;

const users = [
  { id: U(1), dni: '48219032', nombres: 'Ana Martínez', correo: 'demo@peya.com', telefono: '987654321', rol: 'ADMIN', estado: 'ACTIVO' },
  { id: U(2), dni: '48219033', nombres: 'Ana Martínez', correo: 'demo@bankhub.com', telefono: '987654321', rol: 'ADMIN', estado: 'ACTIVO' },
  { id: U(3), dni: '10203040', nombres: 'Carlos Ruiz', correo: 'carlos.ruiz@peya.com', telefono: '987112233', rol: 'CLIENTE', estado: 'ACTIVO' },
  { id: U(4), dni: '70809010', nombres: 'Lucía Fernández', correo: 'lucia.fernandez@peya.com', telefono: '987445566', rol: 'CLIENTE', estado: 'INACTIVO' },
  { id: U(5), dni: '88888888', nombres: 'Ana Martínez', correo: 'ana.martinez@peya.com', telefono: '987778899', rol: 'ADMIN', estado: 'ACTIVO' },
];

const accounts = [
  { id: A(1), cliente: U(2), tipo: 1, moneda: 'PEN', cci: '191-3001234567-89', saldo: '12480.50' },
  { id: A(2), cliente: U(2), tipo: 2, moneda: 'PEN', cci: '191-3009876543-21', saldo: '34120.00' },
  { id: A(3), cliente: U(2), tipo: 3, moneda: 'USD', cci: '191-3005647382-10', saldo: '8905.75' },
  { id: A(4), cliente: U(3), tipo: 1, moneda: 'PEN', cci: '191-3004455667-70', saldo: '5200.00' },
  { id: A(5), cliente: U(1), tipo: 1, moneda: 'PEN', cci: '191-3002233445-51', saldo: '1500.00' },
];

async function main() {
  const hash = bcrypt.hashSync('123456', 8);
  for (const u of users) {
    await prisma.cliente.upsert({
      where: { id: u.id },
      update: {},
      create: { ...u, password_hash: hash },
    });
  }
  for (const a of accounts) {
    await prisma.cuenta.upsert({
      where: { id: a.id },
      update: {},
      create: {
        id: a.id,
        id_cliente: a.cliente,
        id_tipo_cuenta: a.tipo,
        moneda: a.moneda,
        cci: a.cci,
        saldo: a.saldo,
      },
    });
  }
  const hasMov = await prisma.movimiento.count({ where: { id_cuenta: A(1) } });
  if (!hasMov) {
    const day = (d: number) => new Date(Date.UTC(2026, 8, d, 15, 0, 0));
    const movs = [
      { tipo: 'CREDITO', categoria: 'Ingreso', monto: '2450.00', descripcion: 'Depósito de nómina · Banco', fecha: day(4), saldo: '12480.50' },
      { tipo: 'DEBITO', categoria: 'Servicios', monto: '146.20', descripcion: 'Pago de servicios · Luz del Sur', fecha: day(3), saldo: '10030.50' },
      { tipo: 'DEBITO', categoria: 'Comercio', monto: '219.90', descripcion: 'Compra online · Amazon.com.pe', fecha: day(2), saldo: '10176.70' },
      { tipo: 'DEBITO', categoria: 'Retiro', monto: '400.00', descripcion: 'Retiro cajero · BCP', fecha: day(1), saldo: '10396.60' },
    ];
    for (const m of movs) {
      await prisma.movimiento.create({
        data: {
          id_cuenta: A(1),
          tipo: m.tipo,
          categoria: m.categoria,
          monto: m.monto,
          saldo_posterior: m.saldo,
          descripcion: m.descripcion,
          fecha: m.fecha,
        },
      });
    }
  }
  console.log('Seed completado (contraseña demo: 123456).');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
