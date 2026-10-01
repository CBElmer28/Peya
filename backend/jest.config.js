// Pruebas de integracion contra PostgreSQL real (las garantias ACID/locks/UNIQUE dependen de la BD).
// BD de pruebas: bankhub_test (ver docker-compose.postgres.yml + Liquibase con --url ...bankhub_test).
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testRegex: 'test/.*\\.e2e-spec\\.ts$',
  setupFiles: ['<rootDir>/test/setup-env.ts'],
  testTimeout: 60000,
};
