import { afterAll, describe, expect, it } from 'vitest';
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
    expect(response.body.paths['/client/requests'].post.security[0].clientSession).toBeDefined();
    expect(response.body.paths['/client/auth/register'].post.security).toEqual([]);
    expect(response.body.paths['/auth/register'].post.security).toEqual([]);
    expect(response.body.paths['/host/sellers/{sellerId}/documents/{documentId}/review'].patch.security[0].hostSession).toBeDefined();
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

  it('allows credentialed CORS preflight for private document PUT uploads', async () => {
    const response = await request(app).options('/api/v1/seller/documents/rneDoc')
      .set('Origin', 'http://localhost:3002')
      .set('Access-Control-Request-Method', 'PUT')
      .set('Access-Control-Request-Headers', 'content-type,x-file-name');
    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-methods']).toContain('PUT');
  });

  it('requires a Seller session before accepting private document bytes', async () => {
    const response = await request(app).put('/api/v1/seller/documents/rneDoc')
      .set('Content-Type', 'application/pdf').send(Buffer.from('%PDF-1.7'));
    expect(response.status).toBe(401);
  });
});
