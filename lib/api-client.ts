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
      return { userId: res.userId, email: payload.email, name: 'Nuevo Usuario' };
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

export async function getAccountsApi(token?: string) {
  return fetchWithFallback(
    '/accounts',
    {
      method: 'GET',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
    () => mockApi.getAccounts(token || ''),
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
