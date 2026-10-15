process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/talel_seller_test?schema=public';
process.env.COOKIE_SECRET ??= 'test-cookie-secret-with-at-least-32-characters';
process.env.APP_ORIGINS ??= 'http://localhost:3002';
