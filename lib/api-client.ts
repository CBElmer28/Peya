// Cliente API HTTP para comunicar el Frontend de Next.js con el Backend NestJS (http://localhost:4000/api).
// Incluye fallback automático a la capa local para garantizar resiliencia en desarrollo.

import * as mockApi from './mock-api';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

async function fetchWithFallback<T>(
  endpoint: string,
  options: RequestInit,
  fallbackFn: () => Promise<T>,
): Promise<T> {
  try {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });

    if (!res.ok) {
      const errorBody = await res.json().catch(() => ({}));
      const message = errorBody.message || `${res.status}`;
      const err = new Error(typeof message === 'string' ? message : JSON.stringify(message));
      ;(err as any).statusCode = res.status;
      ;(err as any).body = errorBody;
      throw err;
    }

    return (await res.json()) as T;
  } catch (err: any) {
    // Si es un error de red (backend no levantado o CORS), usamos el fallback
    if (err.name === 'TypeError' && err.message.includes('fetch')) {
      console.warn(`[BankHub API] Backend offline en ${BASE_URL}${endpoint}. Usando fallback.`);
      return fallbackFn();
    }
    // Si el backend respondió con un código de error (ej: 401, 409, 422), propagar el error real
    throw err;
  }
}

export async function getNotificationsApi(token?: string): Promise<mockApi.AppNotification[]> {
  return fetchWithFallback(
    '/accounts/notifications',
    {
      method: 'GET',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
    () => mockApi.getNotifications(token || ''),
  );
}

export async function getMovementsApi(token?: string): Promise<mockApi.Movement[]> {
  return fetchWithFallback(
    '/accounts/movements',
    {
      method: 'GET',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
    () => mockApi.getMovements(token || ''),
  );
}

export async function getAllMovementsApi(token?: string): Promise<mockApi.Movement[]> {
  return fetchWithFallback(
    '/accounts/movements',
    {
      method: 'GET',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
    () => mockApi.getAllMovements(token || ''),
  );
}

export async function loginApi(email: string, password: string, rememberMe = true) {
  return fetchWithFallback(
    '/auth/login',
    {
      method: 'POST',
      body: JSON.stringify({ email, password, rememberMe }),
    },
    async () => {
      const res = await mockApi.login(email, password);
      return {
        accessToken: res.token,
        tokenType: 'Bearer',
        user: { id: 'usr-1', ...res.user, role: 'admin' },
      };
    },
  );
}

export async function registerApi(payload: {
  dni: string;
  name?: string;
  email: string;
  phone: string;
  password: string;
  selfieUrl?: string;
}) {
  return fetchWithFallback(
    '/users/register',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    async () => {
      const res = await mockApi.registerUser(payload);
      return { userId: res.userId, email: payload.email, name: payload.name || 'Nuevo Usuario' };
    },
  );
}

export async function lookupDniApi(dni: string) {
  return fetchWithFallback(
    `/reniec/dni/${encodeURIComponent(dni)}`,
    { method: 'GET' },
    () => mockApi.lookupDni(dni),
  );
}

export async function verifyFaceApi(selfieDataUrl: string, dni?: string) {
  return fetchWithFallback(
    '/kyc/verify-face',
    {
      method: 'POST',
      body: JSON.stringify({ selfieDataUrl, dni }),
    },
    () => mockApi.verifyFace(selfieDataUrl),
  );
}

export async function checkDniApi(dni: string) {
  return fetchWithFallback(
    `/users/check-dni?dni=${encodeURIComponent(dni)}`,
    { method: 'GET' },
    async () => ({ exists: mockApi.isDniRegistered(dni) }),
  );
}

export async function checkEmailApi(email: string) {
  return fetchWithFallback(
    `/users/check-email?email=${encodeURIComponent(email)}`,
    { method: 'GET' },
    async () => ({ exists: mockApi.isEmailRegistered(email) }),
  );
}

export async function getAccountsApi(token?: string): Promise<mockApi.Account[]> {
  return fetchWithFallback(
    '/accounts',
    {
      method: 'GET',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
    () => mockApi.getAccounts(token || ''),
  );
}

export async function createAccountApi(
  token: string,
  payload: { type: 'savings' | 'checking' | 'usd'; currency: 'PEN' | 'USD' },
): Promise<mockApi.Account> {
  return fetchWithFallback(
    '/accounts',
    {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: JSON.stringify(payload),
    },
    () => mockApi.createAccount(token, payload),
  );
}

export async function logoutApi(token?: string) {
  return fetchWithFallback(
    '/auth/logout',
    {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
    async () => ({ success: true, message: 'Sesión cerrada.' }),
  );
}

export async function getProfileApi(token: string) {
  return fetchWithFallback(
    '/auth/profile',
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    },
    async () => mockApi.getCurrentUser(token),
  );
}

export async function forgotPasswordApi(identifier: string) {
  return fetchWithFallback(
    '/auth/forgot-password',
    {
      method: 'POST',
      body: JSON.stringify({ identifier }),
    },
    async () => ({
      success: true,
      message: 'Se ha enviado un código de recuperación a tu correo.',
    }),
  );
}

export async function verifyResetTokenApi(email: string, token: string) {
  return fetchWithFallback(
    '/auth/verify-reset-token',
    {
      method: 'POST',
      body: JSON.stringify({ email, token }),
    },
    async () => ({ valid: true, message: 'Código verificado.' }),
  );
}

export async function resetPasswordApi(email: string, token: string, newPassword: string) {
  return fetchWithFallback(
    '/auth/reset-password',
    {
      method: 'POST',
      body: JSON.stringify({ email, token, newPassword }),
    },
    async () => ({
      success: true,
      message: 'Contraseña actualizada correctamente.',
    }),
  );
}

export async function createTransferApi(
  token: string,
  payload: mockApi.TransferPayload,
  idempotencyKey?: string,
) {
  return fetchWithFallback(
    '/transactions',
    {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
      },
      body: JSON.stringify(payload),
    },
    () => mockApi.createTransfer(token, payload),
  );
}

export async function getClientsApi(token?: string): Promise<mockApi.Client[]> {
  return fetchWithFallback(
    '/users',
    {
      method: 'GET',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
    () => mockApi.getClients(token || ''),
  );
}

export async function createClientApi(
  token: string,
  payload: { name: string; email: string; role: mockApi.ClientRole },
): Promise<mockApi.Client> {
  return fetchWithFallback(
    '/users',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    },
    () => mockApi.createClient(token, payload),
  );
}

export async function updateClientApi(
  token: string,
  clientId: string,
  payload: { name: string; email: string; role: mockApi.ClientRole; status: mockApi.ClientStatus },
): Promise<mockApi.Client> {
  return fetchWithFallback(
    `/users/${encodeURIComponent(clientId)}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    },
    () => mockApi.updateClient(token, clientId, payload),
  );
}

export async function deleteClientApi(token: string, clientId: string): Promise<{ success?: boolean; ok?: boolean }> {
  return fetchWithFallback(
    `/users/${encodeURIComponent(clientId)}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    () => mockApi.deleteClient(token, clientId),
  );
}

export async function getAdminMetricsApi(token?: string): Promise<mockApi.AdminMetric[]> {
  return fetchWithFallback(
    '/admin/metrics',
    {
      method: 'GET',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
    () => mockApi.getAdminMetrics(token || ''),
  );
}

export async function getSupervisedAccountsApi(token?: string): Promise<mockApi.SupervisedAccount[]> {
  return fetchWithFallback(
    '/admin/accounts',
    {
      method: 'GET',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
    () => mockApi.getSupervisedAccounts(token || ''),
  );
}
