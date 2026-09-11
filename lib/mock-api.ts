// Capa de acceso a datos simulada.
// Cada función representa la llamada a un microservicio real. Los bloques
// comentados muestran exactamente dónde iría el fetch() de producción.

export type Account = {
  id: string
  label: string
  type: "savings" | "checking" | "usd"
  balance: string
  detail: string
  subtitleDetail: string
  icon: "wallet" | "savings" | "investment"
  currency: "PEN" | "USD"
  cci: string
  status: "active" | "blocked"
  trendLabel: string
  trendDirection: "up" | "down"
}

export type Movement = {
  id: string
  name: string
  description: string
  date: string
  category: string
  amount: string
  type: "positive" | "negative"
}

export type AppNotification = {
  id: string
  title: string
  detail: string
  unread: boolean
  type: "transfer" | "login" | "document" | "payment" | "alert" | "deposit"
}

export type DniData = {
  dni: string
  nombres: string
  apellidoPaterno: string
  apellidoMaterno: string
  fechaNacimiento: string
}

export type FaceVerifyResult = { match: boolean; confidence: number }

// Base de datos de prueba de usuarios registrados en el sistema
export const REGISTERED_USERS_DB: Array<{ dni: string; email: string; name: string }> = [
  { dni: "48219032", email: "demo@bankhub.com", name: "Ana Martínez" },
  { dni: "10203040", email: "carlos.ruiz@bankhub.com", name: "Carlos Ruiz" },
  { dni: "70809010", email: "lucia.fernandez@bankhub.com", name: "Lucía Fernández" },
  { dni: "88888888", email: "ana.martinez@bankhub.com", name: "Ana Martínez" },
]

export function isDniRegistered(dni: string): boolean {
  return REGISTERED_USERS_DB.some((u) => u.dni === dni.trim())
}

export function isEmailRegistered(email: string): boolean {
  return REGISTERED_USERS_DB.some((u) => u.email.toLowerCase() === email.trim().toLowerCase())
}

export async function lookupDni(dni: string): Promise<DniData> {
  // TODO: reemplazar por fetch real a un proveedor de consulta RENIEC en Perú,
  // ej. GET https://api.apis.net.pe/v2/reniec/dni?numero={dni}
  // Headers: Authorization: Bearer <API_KEY_APIS_PERU>
  await new Promise((resolve) => setTimeout(resolve, 800))
  if (dni.length !== 8 || !/^\d+$/.test(dni)) {
    throw new Error("DNI_NOT_FOUND")
  }
  // Verificación de usuario existente por DNI
  if (isDniRegistered(dni)) {
    const existing = REGISTERED_USERS_DB.find((u) => u.dni === dni.trim())
    const err = new Error("DNI_ALREADY_REGISTERED")
    ;(err as unknown as { userName?: string }).userName = existing?.name ?? "Usuario"
    throw err
  }
  return {
    dni,
    nombres: "Priscilla Fernanda",
    apellidoPaterno: "Quispe",
    apellidoMaterno: "Torres",
    fechaNacimiento: "12/03/1998",
  }
}

export async function verifyFace(selfieDataUrl: string): Promise<FaceVerifyResult> {
  // TODO: reemplazar por fetch real a un servicio de verificación facial
  // (ej. Amazon Rekognition CompareFaces, Azure Face API, o un proveedor peruano de KYC)
  // que compare selfieDataUrl contra la foto asociada al DNI consultado.
  void selfieDataUrl
  await new Promise((resolve) => setTimeout(resolve, 1400))
  return { match: true, confidence: 0.94 }
}

export async function registerUser(payload: {
  dni: string
  email: string
  phone: string
  password: string
}): Promise<{ userId: string; token: string }> {
  // TODO: user-management-service · POST /register
  await new Promise((resolve) => setTimeout(resolve, 700))
  if (isDniRegistered(payload.dni)) {
    throw new Error("DNI_ALREADY_REGISTERED")
  }
  if (isEmailRegistered(payload.email)) {
    throw new Error("EMAIL_ALREADY_REGISTERED")
  }
  REGISTERED_USERS_DB.push({
    dni: payload.dni,
    email: payload.email.trim(),
    name: "Nuevo Usuario",
  })
  return { userId: crypto.randomUUID(), token: "mock-session-token" }
}

function formatCurrency(amount: number, currency: "PEN" | "USD"): string {
  const formatted = new Intl.NumberFormat("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
  return currency === "PEN" ? `S/. ${formatted}` : `USD ${formatted}`
}

function generateCci(): string {
  const digits = Array.from({ length: 15 }, () => Math.floor(Math.random() * 10)).join("")
  return `191-${digits.slice(0, 4)}${digits.slice(4, 8)}${digits.slice(8, 12)}-${digits.slice(12, 15)}`
}

export type Session = {
  token: string
  user: { name: string; email: string }
}

const NETWORK_DELAY = 700

function delay<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), NETWORK_DELAY))
}

/**
 * auth-service · POST /auth/login
 * Valida credenciales y devuelve un token de sesión.
 * Credenciales de demostración: demo@bankhub.com / 123456
 */
export async function login(email: string, password: string): Promise<Session> {
  const cleanEmail = email.trim().toLowerCase()
  const matchedUser = REGISTERED_USERS_DB.find((u) => u.email.toLowerCase() === cleanEmail)
  
  const isDemo = cleanEmail === "demo@bankhub.com" && password === "123456"
  const isRegisteredValid = matchedUser && (password === "123456" || password.length >= 8)

  if (!isDemo && !isRegisteredValid) {
    // Simula respuesta 401 Unauthorized del auth-service.
    await delay(null)
    throw new Error("401")
  }

  const name = matchedUser?.name ?? "Ana Martínez"

  return delay<Session>({
    token: `mock.jwt.${Date.now()}.${Math.random().toString(36).substring(2, 9)}`,
    user: { name, email: cleanEmail },
  })
}

export async function getCurrentUser(token: string): Promise<{ id: string; name: string; email: string; role: string }> {
  void token
  return delay({
    id: 'usr-1',
    name: 'Ana Martínez',
    email: 'demo@bankhub.com',
    role: 'admin',
  })
}

/**
 * account-service · GET /accounts
 * Devuelve el resumen de cuentas del usuario autenticado.
 */
export async function getAccounts(token: string): Promise<Account[]> {
  // --- Integración real (account-service) ---
  // const res = await fetch(`${process.env.NEXT_PUBLIC_ACCOUNT_SERVICE_URL}/accounts`, {
  //   headers: { Authorization: `Bearer ${token}` },
  // })
  // return (await res.json()) as Account[]
  // ------------------------------------------
  void token

  return delay<Account[]>([
    {
      id: "acc-1",
      label: "Cuenta corriente",
      type: "checking",
      balance: "S/. 12,480.50",
      detail: "Disponible para uso inmediato",
      subtitleDetail: "Sin comisión de mantenimiento",
      icon: "wallet",
      currency: "PEN",
      cci: "191-3001234567-89",
      status: "active",
      trendLabel: "+4.2% respecto al mes pasado",
      trendDirection: "up",
    },
    {
      id: "acc-2",
      label: "Ahorros",
      type: "savings",
      balance: "S/. 34,120.00",
      detail: "Meta anual · 68% alcanzado",
      subtitleDetail: "Interés anual: 3.5% TEA",
      icon: "savings",
      currency: "PEN",
      cci: "191-3009876543-21",
      status: "active",
      trendLabel: "+1.8% respecto al mes pasado",
      trendDirection: "up",
    },
    {
      id: "acc-3",
      label: "Cuenta en dólares",
      type: "usd",
      balance: "USD 8,905.75",
      detail: "Portafolio diversificado",
      subtitleDetail: "TC referencial: S/. 3.78",
      icon: "investment",
      currency: "USD",
      cci: "191-3005647382-10",
      status: "active",
      trendLabel: "-2.1% respecto al mes pasado",
      trendDirection: "down",
    },
  ])
}

/**
 * account-service · GET /accounts/all-movements
 * Devuelve el historial completo de operaciones del usuario.
 */
export async function getAllMovements(token: string): Promise<Movement[]> {
  // TODO: account-service /api/accounts (GET)
  void token

  return delay<Movement[]>([
    {
      id: "all-mov-1",
      name: "Nómina",
      description: "Abono mensual · Cuenta corriente",
      date: "04/09/2026",
      category: "Ingreso",
      amount: "+S/. 2,450.00",
      type: "positive",
    },
    {
      id: "all-mov-2",
      name: "Luz del Sur",
      description: "Pago de servicios · Cuenta corriente",
      date: "03/09/2026",
      category: "Servicios",
      amount: "-S/. 146.20",
      type: "negative",
    },
    {
      id: "all-mov-3",
      name: "Amazon.com.pe",
      description: "Compra online · Cuenta corriente",
      date: "02/09/2026",
      category: "Comercio",
      amount: "-S/. 219.90",
      type: "negative",
    },
    {
      id: "all-mov-4",
      name: "Transferencia a Ahorros",
      description: "Ahorro programado · Ahorros",
      date: "01/09/2026",
      category: "Transferencia",
      amount: "-S/. 600.00",
      type: "negative",
    },
    {
      id: "all-mov-5",
      name: "Interbank",
      description: "Pago de deuda · Tarjeta Interbank",
      date: "31/08/2026",
      category: "Deuda",
      amount: "-S/. 980.00",
      type: "negative",
    },
    {
      id: "all-mov-6",
      name: "María López",
      description: "Transferencia recibida · Cuenta corriente",
      date: "30/08/2026",
      category: "Transferencia",
      amount: "+S/. 350.00",
      type: "positive",
    },
    {
      id: "all-mov-7",
      name: "Falabella",
      description: "Compra online · Cuenta en dólares",
      date: "29/08/2026",
      category: "Comercio",
      amount: "-USD 48.60",
      type: "negative",
    },
    {
      id: "all-mov-8",
      name: "Scotiabank",
      description: "Retiro cajero · Cuenta corriente",
      date: "28/08/2026",
      category: "Retiro",
      amount: "-S/. 400.00",
      type: "negative",
    },
    {
      id: "all-mov-9",
      name: "Dividendos",
      description: "Abono por inversión · Cuenta en dólares",
      date: "27/08/2026",
      category: "Ingreso",
      amount: "+USD 120.00",
      type: "positive",
    },
    {
      id: "all-mov-10",
      name: "Internet Claro",
      description: "Pago de servicios · Cuenta corriente",
      date: "26/08/2026",
      category: "Servicios",
      amount: "-S/. 89.90",
      type: "negative",
    },
    {
      id: "all-mov-11",
      name: "Spotify",
      description: "Compra online · Cuenta en dólares",
      date: "25/08/2026",
      category: "Comercio",
      amount: "-USD 7.99",
      type: "negative",
    },
    {
      id: "all-mov-12",
      name: "Transferencia a Ahorros",
      description: "Meta de emergencia · Ahorros",
      date: "24/08/2026",
      category: "Transferencia",
      amount: "-S/. 300.00",
      type: "negative",
    },
  ])
}

/**
 * account-service · POST /accounts
 * Crea una nueva cuenta del usuario autenticado.
 */
export async function createAccount(
  token: string,
  payload: { type: "savings" | "checking" | "usd"; currency: "PEN" | "USD" },
): Promise<Account> {
  // TODO: account-service /api/accounts (POST)
  void token

  const id = `acc-${Date.now().toString().slice(-8)}`
  const label =
    payload.type === "savings"
      ? "Ahorros"
      : payload.type === "checking"
        ? "Cuenta corriente"
        : "Cuenta en dólares"

  const subtitleDetail =
    payload.type === "savings"
      ? "Interés anual: 3.5% TEA"
      : payload.type === "checking"
        ? "Sin comisión de mantenimiento"
        : "TC referencial: S/. 3.78"

  const icon = payload.type === "savings" ? "savings" : payload.type === "checking" ? "wallet" : "investment"

  return delay<Account>({
    id,
    label,
    type: payload.type,
    balance: formatCurrency(0, payload.currency),
    detail: "Cuenta recién abierta",
    subtitleDetail,
    icon,
    currency: payload.currency,
    cci: generateCci(),
    status: "active",
    trendLabel: "0.0% este mes",
    trendDirection: "up",
  })
}

/**
 * account-service · GET /accounts/movements
 * Devuelve los movimientos recientes del usuario.
 */
export async function getMovements(token: string): Promise<Movement[]> {
  // --- Integración real (account-service) ---
  // const res = await fetch(`${process.env.NEXT_PUBLIC_ACCOUNT_SERVICE_URL}/accounts/movements`, {
  //   headers: { Authorization: `Bearer ${token}` },
  // })
  // return (await res.json()) as Movement[]
  // ------------------------------------------
  void token

  return delay<Movement[]>([
    {
      id: "mov-1",
      name: "Nómina",
      description: "Depósito de nómina · Banco",
      date: "04/09/2026",
      category: "Ingreso",
      amount: "+S/. 2,450.00",
      type: "positive",
    },
    {
      id: "mov-2",
      name: "Luz del Sur",
      description: "Pago de servicios · Luz del Sur",
      date: "03/09/2026",
      category: "Servicios",
      amount: "-S/. 146.20",
      type: "negative",
    },
    {
      id: "mov-3",
      name: "Amazon.com.pe",
      description: "Compra online · Amazon.com.pe",
      date: "02/09/2026",
      category: "Comercio",
      amount: "-S/. 219.90",
      type: "negative",
    },
    {
      id: "mov-4",
      name: "Retiro BCP",
      description: "Retiro cajero · BCP",
      date: "01/09/2026",
      category: "Retiro",
      amount: "-S/. 400.00",
      type: "negative",
    },
    {
      id: "mov-5",
      name: "Interbank",
      description: "Pago de deuda · Tarjeta Interbank",
      date: "31/08/2026",
      category: "Deuda",
      amount: "-S/. 980.00",
      type: "negative",
    },
    {
      id: "mov-6",
      name: "María López",
      description: "Transferencia recibida · María López",
      date: "30/08/2026",
      category: "Transferencia",
      amount: "+S/. 350.00",
      type: "positive",
    },
    {
      id: "mov-7",
      name: "Falabella",
      description: "Compra online · Falabella",
      date: "29/08/2026",
      category: "Comercio",
      amount: "-S/. 179.50",
      type: "negative",
    },
    {
      id: "mov-8",
      name: "Ahorros",
      description: "Transferencia a cuenta de ahorros",
      date: "28/08/2026",
      category: "Transferencia",
      amount: "-S/. 600.00",
      type: "negative",
    },
  ])
}

/**
 * account-service · GET /accounts/notifications
 * Devuelve las notificaciones del usuario.
 */
export async function getNotifications(token: string): Promise<AppNotification[]> {
  // --- Integración real (account-service) ---
  // const res = await fetch(`${process.env.NEXT_PUBLIC_ACCOUNT_SERVICE_URL}/accounts/notifications`, {
  //   headers: { Authorization: `Bearer ${token}` },
  // })
  // return (await res.json()) as AppNotification[]
  // ------------------------------------------
  void token

  return delay<AppNotification[]>([
    { id: "not-1", title: "Pago recibido de Cliente ACME", detail: "Hace 10 min", unread: true, type: "payment" },
    { id: "not-2", title: "Recordatorio: factura por vencer", detail: "Hace 1 hora", unread: false, type: "alert" },
    { id: "not-3", title: "Nuevo dispositivo inició sesión", detail: "Hace 3 horas", unread: true, type: "login" },
    { id: "not-4", title: "Tu reporte mensual está listo", detail: "Ayer", unread: false, type: "document" },
  ])
}

// Cuentas de origen disponibles con su saldo simulado (en número para validar).
export type SourceAccount = {
  id: string
  label: string
  balance: number
}

export const SOURCE_ACCOUNTS: SourceAccount[] = [
  { id: "src-1", label: "Cuenta corriente **** 4821", balance: 12480.5 },
  { id: "src-2", label: "Ahorros **** 9032", balance: 34120.0 },
  { id: "src-3", label: "Inversiones **** 1177", balance: 8905.75 },
]

export const TRANSACTION_TYPES = [
  { id: "internal", label: "Transferencia entre cuentas propias" },
  { id: "third-party", label: "Transferencia a terceros" },
  { id: "service", label: "Pago de servicios" },
]

export type TransferPayload = {
  transactionType: string
  sourceAccountId: string
  destinationAccount: string
  amount: number
  description: string
}

export type TransferResult = {
  status: "success"
  reference: string
  newBalance: number
}

/**
 * transaction-service · POST /transactions
 * Procesa la transferencia. Valida saldo disponible en el backend y
 * persiste el movimiento de forma atómica (débito origen + crédito destino).
 */
export async function createTransfer(token: string, payload: TransferPayload): Promise<TransferResult> {
  // --- Integración real (transaction-service) ---
  // const res = await fetch(`${process.env.NEXT_PUBLIC_TRANSACTION_SERVICE_URL}/transactions`, {
  //   method: "POST",
  //   headers: {
  //     "Content-Type": "application/json",
  //     Authorization: `Bearer ${token}`,
  //     // Clave de idempotencia para evitar duplicar la transacción ante reintentos.
  //     "Idempotency-Key": crypto.randomUUID(),
  //   },
  //   body: JSON.stringify(payload),
  // })
  // if (res.status === 422) throw new Error("INSUFFICIENT_FUNDS")
  // if (!res.ok) throw new Error("Error de red")
  // return (await res.json()) as TransferResult
  // ----------------------------------------------
  void token

  const source = SOURCE_ACCOUNTS.find((a) => a.id === payload.sourceAccountId)
  if (!source) {
    await delay(null)
    throw new Error("ACCOUNT_NOT_FOUND")
  }

  // Validación de saldo (en producción esto ocurre en el microservicio,
  // aquí se replica para simular la respuesta 422 del backend).
  if (payload.amount > source.balance) {
    await delay(null)
    throw new Error("INSUFFICIENT_FUNDS")
  }

  return delay<TransferResult>({
    status: "success",
    reference: `TRX-${Date.now().toString().slice(-8)}`,
    newBalance: source.balance - payload.amount,
  })
}

/* ==========================================================================
 * MÓDULO ADMINISTRATIVO
 * admin-service / user-management-service
 * ========================================================================== */

export type AdminMetric = {
  id: string
  label: string
  value: string
  growth: string
  trend: "up" | "down"
}

export type AccountStatus = "active" | "blocked"

export type SupervisedAccount = {
  id: string
  client: string
  number: string
  type: "Corriente" | "Ahorros" | "Inversión"
  balance: string
  status: AccountStatus
  recent: boolean
}

export type ClientStatus = "active" | "inactive"

export type ClientRole = "client" | "admin"

export type Client = {
  id: string
  name: string
  email: string
  status: ClientStatus
  role: ClientRole
  registeredAt: string
}

/**
 * admin-service · GET /admin/metrics
 * Devuelve las métricas agregadas del panel administrativo.
 */
export async function getAdminMetrics(token: string): Promise<AdminMetric[]> {
  // --- Integración real (admin-service) ---
  // const res = await fetch(`${process.env.NEXT_PUBLIC_ADMIN_SERVICE_URL}/admin/metrics`, {
  //   headers: { Authorization: `Bearer ${token}` },
  // })
  // return (await res.json()) as AdminMetric[]
  // ----------------------------------------
  void token

  return delay<AdminMetric[]>([
    { id: "m1", label: "Total clientes activos", value: "1,284", growth: "+8.2%", trend: "up" },
    { id: "m2", label: "Cuentas creadas", value: "2,057", growth: "+3.1%", trend: "up" },
    { id: "m3", label: "Volumen total transaccionado", value: "$4.8M", growth: "-1.4%", trend: "down" },
  ])
}

/**
 * admin-service · GET /admin/accounts
 * Devuelve las cuentas supervisadas por el administrador.
 */
export async function getSupervisedAccounts(token: string): Promise<SupervisedAccount[]> {
  // --- Integración real (admin-service) ---
  // const res = await fetch(`${process.env.NEXT_PUBLIC_ADMIN_SERVICE_URL}/admin/accounts`, {
  //   headers: { Authorization: `Bearer ${token}` },
  // })
  // return (await res.json()) as SupervisedAccount[]
  // ----------------------------------------
  void token

  return delay<SupervisedAccount[]>([
    { id: "a1", client: "Ana Martínez", number: "**** 4821", type: "Corriente", balance: "$12,480.50", status: "active", recent: true },
    { id: "a2", client: "Carlos Ruiz", number: "**** 9032", type: "Ahorros", balance: "$34,120.00", status: "active", recent: false },
    { id: "a3", client: "Lucía Fernández", number: "**** 1177", type: "Inversión", balance: "$8,905.75", status: "blocked", recent: true },
    { id: "a4", client: "Diego Torres", number: "**** 5540", type: "Corriente", balance: "$2,310.20", status: "active", recent: false },
    { id: "a5", client: "María López", number: "**** 8801", type: "Ahorros", balance: "$19,742.00", status: "blocked", recent: false },
    { id: "a6", client: "Javier Gómez", number: "**** 3312", type: "Corriente", balance: "$540.90", status: "active", recent: true },
    { id: "a7", client: "Sofía Herrera", number: "**** 7788", type: "Inversión", balance: "$56,000.00", status: "active", recent: false },
    { id: "a8", client: "Pablo Díaz", number: "**** 2204", type: "Ahorros", balance: "$1,205.45", status: "blocked", recent: true },
  ])
}

/**
 * user-management-service · GET /users
 * Devuelve la lista de clientes para el CRUD administrativo.
 */
export async function getClients(token: string): Promise<Client[]> {
  // --- Integración real (user-management-service) ---
  // const res = await fetch(`${process.env.NEXT_PUBLIC_USER_MGMT_SERVICE_URL}/users`, {
  //   headers: { Authorization: `Bearer ${token}` },
  // })
  // return (await res.json()) as Client[]
  // -------------------------------------------------
  void token

  return delay<Client[]>([
    {
      id: "c1",
      name: "Ana Martínez",
      email: "ana.martinez@bankhub.com",
      status: "active",
      role: "admin",
      registeredAt: "2024-01-14",
    },
    {
      id: "c2",
      name: "Carlos Ruiz",
      email: "carlos.ruiz@bankhub.com",
      status: "active",
      role: "client",
      registeredAt: "2024-02-03",
    },
    {
      id: "c3",
      name: "Lucía Fernández",
      email: "lucia.fernandez@bankhub.com",
      status: "inactive",
      role: "client",
      registeredAt: "2024-02-21",
    },
    {
      id: "c4",
      name: "Diego Torres",
      email: "diego.torres@bankhub.com",
      status: "active",
      role: "client",
      registeredAt: "2024-03-09",
    },
    {
      id: "c5",
      name: "María López",
      email: "maria.lopez@bankhub.com",
      status: "inactive",
      role: "client",
      registeredAt: "2024-03-27",
    },
    {
      id: "c6",
      name: "Javier Gómez",
      email: "javier.gomez@bankhub.com",
      status: "active",
      role: "admin",
      registeredAt: "2024-04-11",
    },
    {
      id: "c7",
      name: "Sofía Herrera",
      email: "sofia.herrera@bankhub.com",
      status: "active",
      role: "client",
      registeredAt: "2024-05-02",
    },
    {
      id: "c8",
      name: "Pablo Díaz",
      email: "pablo.diaz@bankhub.com",
      status: "inactive",
      role: "client",
      registeredAt: "2024-05-19",
    },
    {
      id: "c9",
      name: "Valentina Cruz",
      email: "valentina.cruz@bankhub.com",
      status: "active",
      role: "client",
      registeredAt: "2024-06-01",
    },
    {
      id: "c10",
      name: "Andrés Molina",
      email: "andres.molina@bankhub.com",
      status: "active",
      role: "client",
      registeredAt: "2024-06-15",
    },
  ])
}

/**
 * user-management-service · POST /users
 * Crea un nuevo usuario del sistema.
 */
export async function createClient(
  token: string,
  payload: { name: string; email: string; role: ClientRole },
): Promise<Client> {
  // TODO: user-management-service · POST /users
  void token
  await new Promise((resolve) => setTimeout(resolve, 600))
  return {
    id: crypto.randomUUID(),
    name: payload.name,
    email: payload.email,
    role: payload.role,
    status: "active",
    registeredAt: new Date().toISOString().slice(0, 10),
  }
}

/**
 * user-management-service · PATCH /users/:id
 * Actualiza un usuario existente.
 */
export async function updateClient(
  token: string,
  clientId: string,
  payload: { name: string; email: string; role: ClientRole; status: ClientStatus },
): Promise<Client> {
  // TODO: user-management-service · PATCH /users/:id
  void token
  await new Promise((resolve) => setTimeout(resolve, 500))
  return { id: clientId, ...payload, registeredAt: "2024-01-14" }
}

/**
 * user-management-service · DELETE /users/:id
 * Elimina (o desactiva) un cliente.
 */
export async function deleteClient(token: string, clientId: string): Promise<{ ok: true }> {
  // --- Integración real (user-management-service) ---
  // const res = await fetch(`${process.env.NEXT_PUBLIC_USER_MGMT_SERVICE_URL}/users/${clientId}`, {
  //   method: "DELETE",
  //   headers: { Authorization: `Bearer ${token}` },
  // })
  // if (!res.ok) throw new Error("Error al eliminar")
  // return { ok: true }
  // -------------------------------------------------
  void token
  void clientId
  return delay<{ ok: true }>({ ok: true })
}
