import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { app } from '../src/app.js';
import { prisma } from '../src/db.js';
import { deletePrivateDocument } from '../src/documents/storage.js';

const integration = describe.skipIf(!process.env.TEST_DATABASE_URL);
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const email = (name: string) => `${name}-${suffix}@example.test`;

integration('seller database authorization and business rules', () => {
  let sellerA = '';
  let sellerB = '';
  let hostId = '';
  let pendingSellerId = '';
  let testClientId = '';
  let agentA: ReturnType<typeof request.agent>;
  let agentB: ReturnType<typeof request.agent>;
  let hostAgent: ReturnType<typeof request.agent>;
  let pendingAgent: ReturnType<typeof request.agent>;
  let requestId = '';
  let conversationId = '';
  let documentId = '';

  beforeAll(async () => {
    const passwordHash = await bcrypt.hash('integration-test-password', 4);
    const a = await prisma.user.create({ data: { email: email('seller-a'), passwordHash, profile: { create: { name: 'Seller A', shopName: 'Seller A Test Shop', verificationStatus: 'verified' } } } });
    const b = await prisma.user.create({ data: { email: email('seller-b'), passwordHash, profile: { create: { name: 'Seller B', shopName: 'Seller B Test Shop', verificationStatus: 'verified' } } } });
    const host = await prisma.user.create({ data: { email: email('host'), passwordHash, role: 'HOST' } });
    const pending = await prisma.user.create({ data: { email: email('seller-pending'), passwordHash, profile: { create: { name: 'Pending Seller', shopName: 'Pending Seller Test Shop', verificationStatus: 'pending_verification' } } } });
    const client = await prisma.user.create({ data: { email: email('client'), passwordHash, role: 'CLIENT', clientProfile: { create: { name: 'Messaging Test Client' } } } });
    sellerA = a.id; sellerB = b.id; hostId = host.id; pendingSellerId = pending.id; testClientId = client.id;
    agentA = request.agent(app); agentB = request.agent(app); hostAgent = request.agent(app); pendingAgent = request.agent(app);
    await agentA.post('/api/v1/auth/login').send({ email: a.email, password: 'integration-test-password' }).expect(200);
    await agentB.post('/api/v1/auth/login').send({ email: b.email, password: 'integration-test-password' }).expect(200);
    await hostAgent.post('/api/v1/host/auth/login').send({ email: host.email, password: 'integration-test-password' }).expect(200);
    await pendingAgent.post('/api/v1/auth/login').send({ email: pending.email, password: 'integration-test-password' }).expect(200);
    const marketplaceRequest = await prisma.marketplaceRequest.create({ data: { partName: 'Test brake pad', category: 'Mechanical', description: 'Synthetic test request', status: 'PUBLISHED' } });
    requestId = marketplaceRequest.id;
    const conversation = await prisma.conversation.create({ data: { requestId, participants: { create: [{ userId: sellerB }, { userId: testClientId }] } } });
    conversationId = conversation.id;
  });

  afterAll(async () => {
    if (!sellerA && !sellerB && !pendingSellerId) return;
    const documents = await prisma.sellerDocument.findMany({ where: { sellerId: pendingSellerId }, select: { storageName: true } });
    await Promise.all(documents.map((document) => deletePrivateDocument(pendingSellerId, document.storageName)));
    await prisma.hostAuditLog.deleteMany({ where: { actorId: hostId } });
    await prisma.order.deleteMany({ where: { OR: [{ sellerId: sellerA }, { sellerId: sellerB }] } });
    await prisma.offer.deleteMany({ where: { OR: [{ sellerId: sellerA }, { sellerId: sellerB }] } });
    await prisma.inventoryPart.deleteMany({ where: { OR: [{ sellerId: sellerA }, { sellerId: sellerB }] } });
    if (conversationId) await prisma.conversation.deleteMany({ where: { id: conversationId } });
    if (requestId) await prisma.marketplaceRequest.deleteMany({ where: { id: requestId } });
    await prisma.user.deleteMany({ where: { id: { in: [sellerA, sellerB, hostId, pendingSellerId, testClientId] } } });
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
    await agentA.post('/api/v1/seller/offers').send({ ...offerInput, quantity: 2 }).expect(422)
      .expect(({ body }) => expect(body.error.code).toBe('INVALID_OFFER_QUANTITY'));
    await agentA.post('/api/v1/seller/offers').send({ ...offerInput, description: 'Call +216 22 345 678' }).expect(422)
      .expect(({ body }) => expect(body.error.code).toBe('CONTACT_DETAILS_NOT_ALLOWED'));
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

  it('enforces the direct-contact setting on Seller message submissions', async () => {
    await agentB.post(`/api/v1/seller/conversations/${conversationId}/messages`).send({ body: 'Call +216 22 345 678' }).expect(422)
      .expect(({ body }) => expect(body.error.code).toBe('CONTACT_DETAILS_NOT_ALLOWED'));
    await agentB.post(`/api/v1/seller/conversations/${conversationId}/messages`).send({ body: 'Your order is being prepared.' }).expect(201);
  });

  it('submits a private Seller document, reviews it as Host, and then approves the seller', async () => {
    await pendingAgent.get('/api/v1/seller/inventory').expect(403);
    await hostAgent.patch(`/api/v1/host/sellers/${pendingSellerId}/verification`).send({ status: 'verified' }).expect(409)
      .expect(({ body }) => expect(body.error.code).toBe('DOCUMENT_REVIEW_REQUIRED'));

    const upload = await pendingAgent.put('/api/v1/seller/documents/addressDoc')
      .set('Content-Type', 'application/pdf')
      .set('X-File-Name', 'professional-address.pdf')
      .send(Buffer.from('%PDF-1.7\nTalel integration fixture'))
      .expect(201);
    documentId = upload.body.data.id;
    await hostAgent.get(`/api/v1/host/sellers/${pendingSellerId}/documents`).expect(200)
      .expect(({ body }) => expect(body.data.some((document: { id: string }) => document.id === documentId)).toBe(true));
    await hostAgent.get(`/api/v1/host/sellers/${pendingSellerId}/documents/${documentId}/file`).expect(200);
    await hostAgent.patch(`/api/v1/host/sellers/${pendingSellerId}/documents/${documentId}/review`)
      .send({ status: 'approved' }).expect(200);
    await hostAgent.patch(`/api/v1/host/sellers/${pendingSellerId}/verification`)
      .send({ status: 'verified' }).expect(200);
    expect((await prisma.sellerProfile.findUniqueOrThrow({ where: { userId: pendingSellerId } })).verificationStatus).toBe('verified');
    expect(await prisma.hostAuditLog.count({ where: { actorId: hostId, entityId: documentId, action: 'SELLER_DOCUMENT_APPROVED' } })).toBe(1);
    expect(await prisma.hostAuditLog.count({ where: { actorId: hostId, entityId: pendingSellerId, action: 'SELLER_VERIFICATION_CHANGED' } })).toBe(1);
    await pendingAgent.get('/api/v1/seller/inventory').expect(200);
  });
});
