/** Catalogo de permisos (tabla permiso). El codigo es la unica referencia estable desde el servidor. */
export const PERMISSIONS = {
  METRICAS_VER: 'METRICAS_VER',
  CUENTAS_SUPERVISAR: 'CUENTAS_SUPERVISAR',
  CLIENTES_VER: 'CLIENTES_VER',
  CLIENTES_GESTIONAR: 'CLIENTES_GESTIONAR',
  ADMINS_GESTIONAR: 'ADMINS_GESTIONAR',
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/**
 * Cuentas heredadas: clientes con rol ADMIN (tabla cliente) que existian antes del modelo
 * admin/rol/permiso. Conservan el acceso operativo previo, pero nunca la gestion de administradores.
 */
export const LEGACY_ADMIN_PERMISSIONS: readonly PermissionCode[] = [
  PERMISSIONS.METRICAS_VER,
  PERMISSIONS.CUENTAS_SUPERVISAR,
  PERMISSIONS.CLIENTES_VER,
  PERMISSIONS.CLIENTES_GESTIONAR,
];
