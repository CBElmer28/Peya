import { HttpException } from '@nestjs/common';

/** Mismo formato que el error INSUFFICIENT_FUNDS existente: { statusCode, message, error: CODE }. */
export function businessError(status: number, code: string, message: string): HttpException {
  return new HttpException({ statusCode: status, message, error: code }, status);
}
