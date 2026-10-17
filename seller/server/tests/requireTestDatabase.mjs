import { isDisposablePostgresTestUrl } from './testDatabaseSafety.mjs';

if (!process.env.TEST_DATABASE_URL) {
  console.error('TEST_DATABASE_URL is required for PostgreSQL integration tests. Use a disposable test database; no tests were run.');
  process.exit(1);
}

if (!isDisposablePostgresTestUrl(process.env.TEST_DATABASE_URL)) {
  console.error('The database name in TEST_DATABASE_URL must clearly identify a disposable test database (for example, with a test suffix). No tests were run.');
  process.exit(1);
}
