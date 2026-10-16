import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { app } from '../src/app.js';
import { prisma } from '../src/db.js';

const integration = describe.skipIf(!process.env.TEST_DATABASE_URL);
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const email = (name: string) => `client-${name}-${suffix}@example.test`;

integration('Client isolation and competing offer acceptance', () => {
  let clientA = '';
  let clientB = '';
  let sellerId = '';
  let competingSellerId = '';
  let requestA = '';
  let requestB = '';
  let offerA1 = '';
  let offerA2 = '';
  let offerB = '';
  let orderB = '';
  let conversationB = '';
  let conversationA = '';
  let agentA: ReturnType<typeof request.agent>;
  let agentB: ReturnType<typeof request.agent>;
  const categoryA = `Mechanical ${suffix}`;
  const categoryB = `Filters ${suffix}`;
  let categoryIds: string[] = [];

  beforeAll(async () => {
    const passwordHash = await bcrypt.hash('client-integration-password', 4);
    const firstCategory = await prisma.marketplaceCategory.create({ data: { name: categoryA, description: 'Integration test category' } });
    const secondCategory = await prisma.marketplaceCategory.create({ data: { name: categoryB, description: 'Integration test category' } });
    categoryIds = [firstCategory.id, secondCategory.id];
    const a = await prisma.user.create({ data: { email: email('a'), passwordHash, role: 'CLIENT', clientProfile: { create: { name: 'Client A' } } } });
    const b = await prisma.user.create({ data: { email: email('b'), passwordHash, role: 'CLIENT', clientProfile: { create: { name: 'Client B' } } } });
    const seller = await prisma.user.create({ data: { email: email('seller'), passwordHash, role: 'SELLER', profile: { create: { name: 'Test Seller', shopName: 'Client Isolation Seller', verificationStatus: 'verified' } } } });
    const competingSeller = await prisma.user.create({ data: { email: email('competing-seller'), passwordHash, role: 'SELLER', profile: { create: { name: 'Competing Seller', shopName: 'Competing Seller Shop', verificationStatus: 'verified' } } } });
    clientA = a.id; clientB = b.id; sellerId = seller.id; competingSellerId = competingSeller.id;
    agentA = request.agent(app); agentB = request.agent(app);
    await agentA.post('/api/v1/client/auth/login').send({ email: a.email, password: 'client-integration-password' }).expect(200);
    await agentB.post('/api/v1/client/auth/login').send({ email: b.email, password: 'client-integration-password' }).expect(200);
    const ra = await agentA.post('/api/v1/client/requests').send({ partName: 'A brakes', category: categoryA, quantity: 2, location: 'Tunis' }).expect(201);
    const rb = await agentB.post('/api/v1/client/requests').send({ partName: 'B filter', category: categoryB, quantity: 1, location: 'Sfax' }).expect(201);
    requestA = ra.body.data.id; requestB = rb.body.data.id;
    const oa1 = await prisma.offer.create({ data: { sellerId, requestId: requestA, partName: 'A brakes offer one', condition: 'NEW', price: 100, quantity: 2, deliveryFee: 5 } });
    const oa2 = await prisma.offer.create({ data: { sellerId: competingSellerId, requestId: requestA, partName: 'A brakes offer two', condition: 'NEW', price: 110, quantity: 2, deliveryFee: 5 } });
    const ob = await prisma.offer.create({ data: { sellerId, requestId: requestB, partName: 'B filter offer', condition: 'NEW', price: 20 } });
    offerA1 = oa1.id; offerA2 = oa2.id; offerB = ob.id;
    const order = await prisma.order.create({ data: { sellerId, requestId: requestB, offerId: offerB, totalAmount: 20 } });
    orderB = order.id;
    const conversation = await prisma.conversation.create({ data: { requestId: requestB, participants: { create: [{ userId: clientB }, { userId: sellerId }] } } });
    conversationB = conversation.id;
    const ownedConversation = await prisma.conversation.create({ data: { requestId: requestA, participants: { create: [{ userId: clientA }, { userId: sellerId }] } } });
    conversationA = ownedConversation.id;
    await prisma.notification.create({ data: { userId: clientB, type: 'test', title: 'Private', message: 'Client B only' } });
  });

  afterAll(async () => {
    if (!clientA) return;
    await prisma.message.deleteMany({ where: { conversationId: conversationB } });
    await prisma.conversation.deleteMany({ where: { requestId: { in: [requestA, requestB] } } });
    await prisma.order.deleteMany({ where: { requestId: { in: [requestA, requestB] } } });
    await prisma.offer.deleteMany({ where: { requestId: { in: [requestA, requestB] } } });
    await prisma.marketplaceRequest.deleteMany({ where: { id: { in: [requestA, requestB] } } });
    await prisma.user.deleteMany({ where: { id: { in: [clientA, clientB, sellerId, competingSellerId] } } });
    await prisma.marketplaceCategory.deleteMany({ where: { id: { in: categoryIds } } });
  });

  it('keeps Client business records scoped to their owner', async () => {
    const ownRequests = await agentA.get('/api/v1/client/requests').expect(200);
    expect(ownRequests.body.data.map((r: any) => r.id)).toEqual([requestA]);
    await agentA.get(`/api/v1/client/requests/${requestB}`).expect(404);
    const ownOffers = await agentA.get('/api/v1/client/offers').expect(200);
    expect(ownOffers.body.data.map((o: any) => o.id).sort()).toEqual([offerA1, offerA2].sort());
    await agentA.post(`/api/v1/client/offers/${offerB}/accept`).expect(409);
    await agentA.post(`/api/v1/client/offers/${offerB}/reject`).expect(409);
    await agentA.post(`/api/v1/client/requests/${requestB}/cancel`).expect(409);
    await agentA.get(`/api/v1/client/orders/${orderB}`).expect(404);
    await agentA.post(`/api/v1/client/orders/${orderB}/cancel`).expect(409);
    const ownOrders = await agentA.get('/api/v1/client/orders').expect(200);
    expect(ownOrders.body.data).toHaveLength(0);
    const ownConversations = await agentA.get('/api/v1/client/conversations').expect(200);
    expect(ownConversations.body.data.map((conversation: { id: string }) => conversation.id)).toEqual([conversationA]);
    await agentA.get(`/api/v1/client/conversations/${conversationB}/messages`).expect(404);
    await agentA.post(`/api/v1/client/conversations/${conversationB}/messages`).send({ body: 'intrusion' }).expect(404);
    const notificationsA = await agentA.get('/api/v1/client/notifications').expect(200);
    expect(notificationsA.body.data).toHaveLength(0);
    const notificationB = await prisma.notification.findFirstOrThrow({ where: { userId: clientB } });
    await agentA.patch(`/api/v1/client/notifications/${notificationB.id}/read`).expect(404);
    const profileA = await agentA.patch('/api/v1/client/profile').send({ name: 'Changed Client A' }).expect(200);
    expect(profileA.body.data.name).toBe('Changed Client A');
    expect((await prisma.clientProfile.findUniqueOrThrow({ where: { userId: clientB } })).name).toBe('Client B');
  });

  it('accepts only active categories and requires a client-selected location', async () => {
    await agentA.post('/api/v1/client/requests').send({ partName: 'Invalid category', category: `Unknown ${suffix}`, quantity: 1, location: 'Tunis' }).expect(422)
      .expect(({ body }) => expect(body.error.code).toBe('INVALID_CATEGORY'));
    await agentA.post('/api/v1/client/requests').send({ partName: 'Brake pads', category: categoryA, quantity: 1, location: 'Tunis', description: 'Contact me at buyer@example.test' }).expect(422)
      .expect(({ body }) => expect(body.error.code).toBe('CONTACT_DETAILS_NOT_ALLOWED'));
    await agentA.post('/api/v1/client/requests').send({ partName: 'Missing location', category: categoryA, quantity: 1 }).expect(400);
    await agentA.post('/api/v1/client/requests').send({ partName: 'Invalid quantity', category: categoryA, quantity: 0, location: 'Tunis' }).expect(400);
    await agentA.post('/api/v1/client/requests').send({ partName: 'Invalid budget', category: categoryA, quantity: 1, minBudget: 500, maxBudget: 100, location: 'Tunis' }).expect(400);
    await agentA.post('/api/v1/client/requests').send({ partName: 'Invalid vehicle year', category: categoryA, quantity: 1, vehicleYear: 1800, location: 'Tunis' }).expect(400);
    const active = await agentA.get('/api/v1/client/categories').expect(200);
    expect(active.body.data.some((category: { name: string }) => category.name === categoryA)).toBe(true);
    await prisma.marketplaceCategory.update({ where: { id: categoryIds[1] }, data: { isActive: false } });
    await agentB.post('/api/v1/client/requests').send({ partName: 'Inactive category', category: categoryB, quantity: 1, location: 'Sfax' }).expect(422);
  });

  it('enforces direct-contact restrictions on Client message submissions', async () => {
    await agentA.post(`/api/v1/client/conversations/${conversationA}/messages`).send({ body: 'Email me at buyer@example.test' }).expect(422)
      .expect(({ body }) => expect(body.error.code).toBe('CONTACT_DETAILS_NOT_ALLOWED'));
    await agentA.post(`/api/v1/client/conversations/${conversationA}/messages`).send({ body: 'The OEM reference is 123-456-78.' }).expect(201);
  });

  it('accepts at most one competing offer and creates exactly one order', async () => {
    const responses = await Promise.all([
      agentA.post(`/api/v1/client/offers/${offerA1}/accept`),
      agentA.post(`/api/v1/client/offers/${offerA2}/accept`),
    ]);
    expect(responses.filter(r => r.status === 201)).toHaveLength(1);
    expect(responses.filter(r => r.status === 409)).toHaveLength(1);
    const [orders, acceptedOffers, marketplaceRequest] = await Promise.all([
      prisma.order.findMany({ where: { requestId: requestA } }),
      prisma.offer.findMany({ where: { requestId: requestA, status: 'ACCEPTED' } }),
      prisma.marketplaceRequest.findUniqueOrThrow({ where: { id: requestA } }),
    ]);
    expect(orders).toHaveLength(1);
    const acceptedOffer = await prisma.offer.findFirstOrThrow({ where: { requestId: requestA, status: 'ACCEPTED' } });
    expect(Number(orders[0].totalAmount)).toBe(Number(acceptedOffer.price) * acceptedOffer.quantity + Number(acceptedOffer.deliveryFee));
    expect(acceptedOffers).toHaveLength(1);
    expect(marketplaceRequest.status).toBe('OFFER_ACCEPTED');
  });

  it('restores the authenticated Client session and revokes it on logout', async () => {
    const me = await agentA.get('/api/v1/client/auth/me').expect(200);
    expect(me.body.data.id).toBe(clientA);
    await agentA.post('/api/v1/client/auth/logout').expect(204);
    await agentA.get('/api/v1/client/auth/me').expect(401);
    await agentA.get('/api/v1/client/requests').expect(401);
  });
});
