// Cliente API HTTP oficial para comunicar el Frontend de Next.js con el Backend NestJS (http://localhost:4000/api).
// Comunicación directa, autenticada y en tiempo real sin dependencias de mockups ni fallbacks ficticios.

import type * as mockApi from "./mock-api"

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api"

/**
 * Ejecutor HTTP centralizado para peticiones a la API bancaria.
 * Si el servidor está apagado o falla la conexión, arroja un error descriptivo en lugar de enmascararlo con mockups.
 */
async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    })
  } catch (err: any) {
    console.error(`[Peya API Client Error] Fallo de conexión en ${BASE_URL}${endpoint}:`, err)
    throw new Error(
      "No se pudo conectar con el servidor bancario (Backend fuera de línea). Por favor verifica que el backend esté ejecutándose en " +
        BASE_URL,
    )
  }

  if (!res.ok) {
    let errorBody: any = {}
    let rawErrorText = ""

    try {
      rawErrorText = await res.text()
      if (rawErrorText) {
        errorBody = JSON.parse(rawErrorText)
      }
    } catch {
      errorBody = { message: rawErrorText || `HTTP ${res.status}` }
    }

    const message =
      typeof errorBody?.message === "string"
        ? errorBody.message
        : Array.isArray(errorBody?.message)
          ? errorBody.message.join(", ")
          : typeof errorBody?.error === "string"
            ? errorBody.error
            : typeof errorBody?.detail === "string"
              ? errorBody.detail
              : rawErrorText || `HTTP ${res.status}`

    const err = new Error(message) as Error & { statusCode?: number; body?: unknown }
    err.statusCode = res.status
    err.body = errorBody
    throw err
  }

  const text = await res.text()
  if (!text) return undefined as T
  try {
    return JSON.parse(text) as T
  } catch {
    return text as unknown as T
  }
}

// ==========================================
// NOTIFICACIONES & MOVIMIENTOS
// ==========================================

export async function getNotificationsApi(token?: string): Promise<mockApi.AppNotification[]> {
  return fetchApi<mockApi.AppNotification[]>("/accounts/notifications", {
    method: "GET",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
}

export async function getMovementsApi(token?: string): Promise<mockApi.Movement[]> {
  return fetchApi<mockApi.Movement[]>("/accounts/movements", {
    method: "GET",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
}

export async function getAllMovementsApi(token?: string): Promise<mockApi.Movement[]> {
  return fetchApi<mockApi.Movement[]>("/accounts/movements", {
    method: "GET",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
}

// ==========================================
// AUTENTICACIÓN & REGISTRO
// ==========================================

export async function loginApi(email: string, password: string, rememberMe = true) {
  return fetchApi<{
    accessToken: string
    tokenType: string
    expiresIn: string
    user: { id: string; name: string; email: string; role: string }
  }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password, rememberMe }),
  })
}

export async function registerApi(payload: {
  dni: string
  name?: string
  email: string
  phone: string
  password: string
  selfieUrl?: string
}) {
  return fetchApi<{ userId: string; email: string; name: string }>("/users/register", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export async function lookupDniApi(dni: string) {
  return fetchApi<{
    dni: string
    nombres: string
    apellidoPaterno: string
    apellidoMaterno: string
    fechaNacimiento: string
  }>(`/reniec/dni/${encodeURIComponent(dni)}`, { method: "GET" })
}

export async function verifyFaceApi(selfieDataUrl: string, dni?: string) {
  return fetchApi<{ match: boolean; confidence: number }>("/kyc/verify-face", {
    method: "POST",
    body: JSON.stringify({ selfieDataUrl, dni }),
  })
}

export async function checkDniApi(dni: string) {
  return fetchApi<{ exists: boolean; userName?: string }>(
    `/users/check-dni?dni=${encodeURIComponent(dni)}`,
    { method: "GET" },
  )
}

export async function checkEmailApi(email: string) {
  return fetchApi<{ exists: boolean }>(
    `/users/check-email?email=${encodeURIComponent(email)}`,
    { method: "GET" },
  )
}

// ==========================================
// CUENTAS BANCARIAS (ACCOUNT-SERVICE)
// ==========================================

export async function getAccountsApi(token?: string): Promise<mockApi.Account[]> {
  return fetchApi<mockApi.Account[]>("/accounts", {
    method: "GET",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
}

export async function createAccountApi(
  token: string,
  payload: { type: "savings" | "checking" | "usd"; currency: "PEN" | "USD" },
  idempotencyKey?: string,
): Promise<mockApi.Account> {
  return fetchApi<mockApi.Account>("/accounts", {
    method: "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: JSON.stringify(payload),
  })
}

export async function getAccountDetailApi(
  token: string,
  accountId: string,
  page = 1,
): Promise<mockApi.AccountDetailResponse> {
  return fetchApi<mockApi.AccountDetailResponse>(
    `/accounts/${encodeURIComponent(accountId)}?page=${page}`,
    {
      method: "GET",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
  )
}

export async function searchMovementsApi(
  token: string,
  params: mockApi.MovementsQueryParams,
): Promise<mockApi.MovementsPageResponse> {
  const queryParts: string[] = []
  if (params.page) queryParts.push(`page=${params.page}`)
  if (params.limit) queryParts.push(`limit=${params.limit}`)
  if (params.from) queryParts.push(`from=${encodeURIComponent(params.from)}`)
  if (params.to) queryParts.push(`to=${encodeURIComponent(params.to)}`)
  if (params.type && params.type !== "all") queryParts.push(`type=${params.type}`)
  if (params.q) queryParts.push(`q=${encodeURIComponent(params.q)}`)
  if (params.accountId) queryParts.push(`accountId=${encodeURIComponent(params.accountId)}`)

  const qs = queryParts.length ? `?${queryParts.join("&")}` : ""

  return fetchApi<mockApi.MovementsPageResponse>(`/movements${qs}`, {
    method: "GET",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
}

// ==========================================
// SESIÓN & PERFIL
// ==========================================

export async function logoutApi(token?: string) {
  return fetchApi<{ success: boolean; message: string }>("/auth/logout", {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
}

export async function getProfileApi(token: string) {
  return fetchApi<{ id: string; name: string; email: string; role: string }>("/auth/profile", {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  })
}

export async function forgotPasswordApi(identifier: string) {
  return fetchApi<{ success: boolean; message: string }>("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ identifier }),
  })
}

export async function verifyResetTokenApi(email: string, token: string) {
  return fetchApi<{ valid: boolean; message: string }>("/auth/verify-reset-token", {
    method: "POST",
    body: JSON.stringify({ email, token }),
  })
}

export async function resetPasswordApi(email: string, token: string, newPassword: string) {
  return fetchApi<{ success: boolean; message: string }>("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ email, token, newPassword }),
  })
}

// ==========================================
// TRANSFERENCIAS BANCARIAS (TRANSACTIONS)
// ==========================================

export async function createTransferApi(token: string, payload: mockApi.TransferPayload, idempotencyKey?: string) {
  return fetchApi<mockApi.TransferResult>("/transactions", {
    method: "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: JSON.stringify(payload),
  })
}

export async function createInternalTransferApi(
  token: string,
  payload: {
    sourceAccountId: string
    destinationAccountId: string
    amount: number
    description?: string
  },
  idempotencyKey?: string,
): Promise<mockApi.TransferResult> {
  return fetchApi<mockApi.TransferResult>("/transactions/internal", {
    method: "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: JSON.stringify(payload),
  })
}

export async function createThirdPartyTransferApi(
  token: string,
  payload: {
    sourceAccountId: string
    destinationCci: string
    amount: number
    description?: string
  },
  idempotencyKey?: string,
): Promise<mockApi.TransferResult> {
  return fetchApi<mockApi.TransferResult>("/transactions/third-party", {
    method: "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: JSON.stringify(payload),
  })
}

export async function validateDestinationCciApi(
  token: string,
  cci: string,
): Promise<mockApi.RecipientValidation> {
  return fetchApi<mockApi.RecipientValidation>(
    `/transactions/third-party/validate?cci=${encodeURIComponent(cci)}`,
    {
      method: "GET",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
  )
}

export async function getRecentRecipientsApi(
  token: string,
  limit = 5,
  page = 1,
): Promise<mockApi.RecentRecipient[]> {
  return fetchApi<mockApi.RecentRecipient[]>(
    `/transactions/recent-recipients?limit=${limit}&page=${page}`,
    {
      method: "GET",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
  )
}

export async function getReceiptApi(
  token: string,
  transferId: string,
): Promise<mockApi.TransferReceipt> {
  return fetchApi<mockApi.TransferReceipt>(
    `/transactions/${encodeURIComponent(transferId)}/receipt`,
    {
      method: "GET",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
  )
}

// ==========================================
// PANEL ADMINISTRATIVO (ADMIN-SERVICE)
// ==========================================

export async function getClientsApi(token?: string): Promise<mockApi.Client[]> {
  return fetchApi<mockApi.Client[]>("/users", {
    method: "GET",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
}

export async function createClientApi(
  token: string,
  payload: { name: string; email: string; role: mockApi.ClientRole },
): Promise<mockApi.Client> {
  return fetchApi<mockApi.Client>("/users", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  })
}

export async function updateClientApi(
  token: string,
  clientId: string,
  payload: { name: string; email: string; role: mockApi.ClientRole; status: mockApi.ClientStatus },
): Promise<mockApi.Client> {
  return fetchApi<mockApi.Client>(`/users/${encodeURIComponent(clientId)}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  })
}

export async function deleteClientApi(token: string, clientId: string): Promise<{ success?: boolean; ok?: boolean }> {
  return fetchApi<{ success?: boolean; ok?: boolean }>(`/users/${encodeURIComponent(clientId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  })
}

export async function getAdminMetricsApi(token?: string): Promise<mockApi.AdminMetric[]> {
  return fetchApi<mockApi.AdminMetric[]>("/admin/metrics", {
    method: "GET",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
}

export async function getSupervisedAccountsApi(token?: string): Promise<mockApi.SupervisedAccount[]> {
  return fetchApi<mockApi.SupervisedAccount[]>("/admin/accounts", {
    method: "GET",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
}
