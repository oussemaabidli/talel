import { afterAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/db.js';

afterAll(async () => { await prisma.$disconnect(); });

describe('Talel Seller API', () => {
  it('reports health without requiring the database', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  it('serves the OpenAPI contract', async () => {
    const response = await request(app).get('/api/v1/openapi.json');
    expect(response.status).toBe(200);
    expect(response.body.openapi).toBe('3.1.0');
    expect(response.body.paths['/seller/inventory/{id}/stock']).toBeDefined();
    expect(response.body.paths['/host/sellers/{id}/verification']).toBeDefined();
    expect(response.body.paths['/host/users/{id}/registration'].get.security[0].hostSession).toBeDefined();
    expect(response.body.paths['/client/requests'].post.security[0].clientSession).toBeDefined();
    expect(response.body.paths['/client/auth/register'].post.security).toEqual([]);
    expect(response.body.paths['/auth/register'].post.security).toEqual([]);
    expect(response.body.paths['/host/sellers/{sellerId}/documents/{documentId}/review'].patch.security[0].hostSession).toBeDefined();
    expect(response.body.paths['/host/reports'].get.security[0].hostSession).toBeDefined();
    expect(response.body.paths['/support/contact'].get.security).toEqual([]);
  });

  it('exposes only a configured support address and hides the seeded placeholder', async () => {
    const lookup = vi.spyOn(prisma.platformSetting, 'findUnique');
    try {
      lookup.mockResolvedValueOnce({ value: 'support@autopartspro.dz' } as any);
      const placeholder = await request(app).get('/api/v1/support/contact').expect(200);
      expect(placeholder.body.data).toEqual({ email: null });
      lookup.mockResolvedValueOnce({ value: 'help@example.test' } as any);
      const configured = await request(app).get('/api/v1/support/contact').expect(200);
      expect(configured.body.data).toEqual({ email: 'help@example.test' });
    } finally { lookup.mockRestore(); }
  });

  it('validates registration before touching the database', async () => {
    const response = await request(app).post('/api/v1/auth/register').send({ email: 'bad', password: 'short' });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects unauthenticated access to seller inventory', async () => {
    const response = await request(app).get('/api/v1/seller/inventory');
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('rejects unauthenticated access to Host management routes', async () => {
    const response = await request(app).get('/api/v1/host/users');
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
    await request(app).get('/api/v1/host/users/example-client/registration').expect(401);
  });

  it('rejects unauthenticated access to Client business data', async () => {
    const response = await request(app).get('/api/v1/client/requests');
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('validates Client registration before touching the database', async () => {
    const response = await request(app).post('/api/v1/client/auth/register').send({ email: 'bad', password: 'short', role: 'HOST' });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rate limits repeated Client registration attempts', async () => {
    // The preceding validation test uses the first attempt in this process-local limiter window.
    for (let attempt = 0; attempt < 9; attempt += 1) {
      const response = await request(app).post('/api/v1/client/auth/register').send({ email: 'bad', password: 'short' });
      expect(response.status).toBe(400);
    }
    const response = await request(app).post('/api/v1/client/auth/register').send({ email: 'bad', password: 'short' });
    expect(response.status).toBe(429);
    expect(response.body.error.code).toBe('RATE_LIMITED');
    await request(app).post('/api/v1/client/auth/login').send({ email: 'bad', password: 'short' }).expect(429);
  });

  it('rate limits Seller and Host login attempts before database access', async () => {
    // Seller login shares its limiter with registration; the earlier Seller registration validation test used one attempt.
    for (let attempt = 0; attempt < 9; attempt += 1) {
      await request(app).post('/api/v1/auth/login').send({ email: 'bad', password: '' }).expect(400);
    }
    await request(app).post('/api/v1/auth/login').send({ email: 'bad', password: '' }).expect(429);
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await request(app).post('/api/v1/host/auth/login').send({ email: 'bad', password: '' }).expect(400);
    }
    await request(app).post('/api/v1/host/auth/login').send({ email: 'bad', password: '' }).expect(429);
  });

  it('allows credentialed CORS preflight for private document PUT uploads', async () => {
    const response = await request(app).options('/api/v1/seller/documents/rneDoc')
      .set('Origin', 'http://localhost:3002')
      .set('Access-Control-Request-Method', 'PUT')
      .set('Access-Control-Request-Headers', 'content-type,x-file-name');
    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-methods']).toContain('PUT');
  });

  it('allows credentialed CORS preflight from the Admin IPv4 loopback origin in development', async () => {
    const response = await request(app).options('/api/v1/host/auth/login')
      .set('Origin', 'http://127.0.0.1:3003')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type');
    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe('http://127.0.0.1:3003');
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  it('allows the documented Client development origin with credentials', async () => {
    const response = await request(app).options('/api/v1/client/auth/login')
      .set('Origin', 'http://localhost:3001')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type');
    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3001');
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  it('allows the documented Admin localhost origin with credentials', async () => {
    const response = await request(app).options('/api/v1/host/auth/login')
      .set('Origin', 'http://localhost:3003')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type');
    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3003');
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  it('rejects unsupported Admin origins without emitting credentialed CORS headers', async () => {
    const response = await request(app).options('/api/v1/host/auth/login')
      .set('Origin', 'http://localhost:3004')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type');
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('ORIGIN_NOT_ALLOWED');
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
    expect(response.headers['access-control-allow-credentials']).toBeUndefined();
  });

  it('requires a Seller session before accepting private document bytes', async () => {
    const response = await request(app).put('/api/v1/seller/documents/rneDoc')
      .set('Content-Type', 'application/pdf').send(Buffer.from('%PDF-1.7'));
    expect(response.status).toBe(401);
  });
});
