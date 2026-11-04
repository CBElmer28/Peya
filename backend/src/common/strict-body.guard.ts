import { CanActivate, ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { businessError } from './business-error';

export const STRICT_BODY_KEY = 'strict_body';

export interface StrictBodyRules {
  /** Unicos campos aceptados en el cuerpo. */
  allowed: readonly string[];
  /** Campos que existen en el recurso pero que quien llama no puede tocar: 403 en vez de 400. */
  protected?: readonly string[];
}

export const StrictBody = (rules: StrictBodyRules) => SetMetadata(STRICT_BODY_KEY, rules);

/**
 * Autorizacion por campo sobre el cuerpo ORIGINAL. Debe ser un guard: el ValidationPipe global
 * (whitelist) descarta los campos sobrantes antes de que cualquier pipe del endpoint los vea, y
 * ignorarlos en silencio ocultaria intentos de modificar campos protegidos.
 * Los mensajes no repiten nombres ni valores enviados por el cliente.
 */
@Injectable()
export class StrictBodyGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const rules = this.reflector.getAllAndOverride<StrictBodyRules | undefined>(STRICT_BODY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!rules) return true;

    const body = context.switchToHttp().getRequest().body;
    if (body === undefined || body === null) return true; // lo valida el DTO (campos obligatorios)
    if (typeof body !== 'object' || Array.isArray(body)) {
      throw businessError(400, 'INVALID_BODY', 'El cuerpo de la solicitud debe ser un objeto JSON.');
    }

    const keys = Object.keys(body);
    if (rules.protected && keys.some((k) => rules.protected.includes(k))) {
      throw businessError(403, 'FIELD_NOT_EDITABLE', 'La solicitud incluye campos que no pueden modificarse.');
    }
    if (keys.some((k) => !rules.allowed.includes(k))) {
      throw businessError(400, 'UNKNOWN_FIELDS', 'La solicitud incluye campos no permitidos.');
    }
    return true;
  }
}
