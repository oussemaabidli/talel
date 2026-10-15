import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { app } from '../src/app.js';
import { prisma } from '../src/db.js';

const integration = describe.skipIf(!process.env.TEST_DATABASE_URL);
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const email = (name: string) => `${name}-${suffix}@example.test`;

integration('seller database authorization and business rules', () => {
  let sellerA = '';
  let sellerB = '';
  let hostId = '';
  let agentA: ReturnType<typeof request.agent>;
  let agentB: ReturnType<typeof request.agent>;
  let hostAgent: ReturnType<typeof request.agent>;
  let requestId = '';

  beforeAll(async () => {
    const passwordHash = await bcrypt.hash('integration-test-password', 4);
    const [a, b, host] = await Promise.all([
      prisma.user.create({ data: { email: email('seller-a'), passwordHash, profile: { create: { name: 'Seller A', shopName: 'Seller A Test Shop', verificationStatus: 'verified' } } } }),
      prisma.user.create({ data: { email: email('seller-b'), passwordHash, profile: { create: { name: 'Seller B', shopName: 'Seller B Test Shop', verificationStatus: 'verified' } } } }),
      prisma.user.create({ data: { email: email('host'), passwordHash, role: 'HOST' } }),
    ]);
    sellerA = a.id; sellerB = b.id; hostId = host.id;
    agentA = request.agent(app); agentB = request.agent(app); hostAgent = request.agent(app);
    await Promise.all([
      agentA.post('/api/v1/auth/login').send({ email: a.email, password: 'integration-test-password' }).expect(200),
      agentB.post('/api/v1/auth/login').send({ email: b.email, password: 'integration-test-password' }).expect(200),
      hostAgent.post('/api/v1/host/auth/login').send({ email: host.email, password: 'integration-test-password' }).expect(200),
    ]);
    const marketplaceRequest = await prisma.marketplaceRequest.create({ data: { partName: 'Test brake pad', category: 'Mechanical', description: 'Synthetic test request', status: 'PUBLISHED' } });
    requestId = marketplaceRequest.id;
  });

  afterAll(async () => {
    if (!sellerA && !sellerB) return;
    await prisma.hostAuditLog.deleteMany({ where: { actorId: hostId } });
    await prisma.order.deleteMany({ where: { OR: [{ sellerId: sellerA }, { sellerId: sellerB }] } });
    await prisma.offer.deleteMany({ where: { OR: [{ sellerId: sellerA }, { sellerId: sellerB }] } });
    await prisma.inventoryPart.deleteMany({ where: { OR: [{ sellerId: sellerA }, { sellerId: sellerB }] } });
    if (requestId) await prisma.marketplaceRequest.deleteMany({ where: { id: requestId } });
    await prisma.user.deleteMany({ where: { id: { in: [sellerA, sellerB, hostId] } } });
  });

  it('keeps inventory private and prevents negative stock', async () => {
    const created = await agentA.post('/api/v1/seller/inventory').send({ partName: 'Private part', sku: `SKU-${suffix}`, brand: 'Test', category: 'Mechanical', condition: 'NEW', price: 25.5, stock: 0, minimumStock: 1 }).expect(201);
    const id = created.body.data.id as string;
    await agentB.get(`/api/v1/seller/inventory/${id}`).expect(404);
    await agentB.patch(`/api/v1/seller/inventory/${id}`).send({ price: 1 }).expect(404);
    await agentA.post(`/api/v1/seller/inventory/${id}/stock`).send({ delta: -1 }).expect(409);
  });

  it('rejects duplicate active offers and invalid order transitions', async () => {
    const offerInput = { requestId, partName: 'Test brake pad', brand: 'Test', referenceNumber: 'TEST-OEM', condition: 'NEW', price: 100, quantity: 1, warranty: '6 months', deliveryFee: 0, estimatedDelivery: '2 days', description: 'Synthetic integration test offer' };
    const first = await agentA.post('/api/v1/seller/offers').send(offerInput).expect(201);
    await agentA.post('/api/v1/seller/offers').send(offerInput).expect(409);
    const offerId = first.body.data.id as string;
    const order = await prisma.order.create({ data: { sellerId: sellerA, requestId, offerId, status: 'OFFER_ACCEPTED', totalAmount: '100.000' } });
    await agentA.post(`/api/v1/seller/orders/${order.id}/events`).send({ status: 'PREPARING' }).expect(409);
    await agentB.get(`/api/v1/seller/orders/${order.id}`).expect(404);
  });

  it('restricts Host sessions and records seller moderation', async () => {
    await agentA.get('/api/v1/host/users').expect(401);
    await hostAgent.patch(`/api/v1/host/users/${sellerA}/status`).send({ isActive: false }).expect(200);
    await agentA.get('/api/v1/seller/profile').expect(401);
    expect(await prisma.hostAuditLog.count({ where: { actorId: hostId, entityId: sellerA, action: 'USER_SUSPENDED' } })).toBe(1);
  });
});
