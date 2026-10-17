process.env.NODE_ENV = 'test';
import { isDisposablePostgresTestUrl } from './testDatabaseSafety.mjs';

if (process.env.TEST_DATABASE_URL) {
  if (!isDisposablePostgresTestUrl(process.env.TEST_DATABASE_URL)) {
    throw new Error('TEST_DATABASE_URL must identify a dedicated disposable PostgreSQL test database.');
  }
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
} else {
  if (process.env.DATABASE_URL) {
    throw new Error('Unit tests refuse DATABASE_URL without TEST_DATABASE_URL. Use a disposable database for integration tests.');
  }
  delete process.env.DATABASE_URL;
}
process.env.COOKIE_SECRET ??= 'test-cookie-secret-with-at-least-32-characters';
process.env.APP_ORIGINS ??= 'http://localhost:3001,http://localhost:3002,http://localhost:3003,http://127.0.0.1:3003';
