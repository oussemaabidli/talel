import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { app } from '../src/app.js';
import { prisma } from '../src/db.js';
import { cleanupOfferLifecycle } from '../src/maintenance/cleanup.js';
import { deletePrivateRequestImage } from '../src/documents/storage.js';

const integration = describe.skipIf(!process.env.TEST_DATABASE_URL);
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const email = (name: string) => `client-${name}-${suffix}@example.test`;
const submitRequest = (agent: ReturnType<typeof request.agent>, data: Record<string, unknown>) => agent.post('/api/v1/client/requests')
  .set('Idempotency-Key', randomUUID())
  .send({ vehicleMake: 'Unlisted Make', vehicleModel: 'Model Z', governorate: 'Tunis', referenceUnavailable: !data.oemReference, ...data });

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
  const extraRequestIds: string[] = [];
  const uploadedPhotos: Array<{ clientId: string; storageName: string; id: string }> = [];
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
    const ra = await submitRequest(agentA, { partName: 'A brakes', category: categoryA, quantity: 2, location: 'Tunis' }).expect(201);
    const rb = await submitRequest(agentB, { partName: 'B filter', category: categoryB, quantity: 1, location: 'Sfax', governorate: 'Sfax' }).expect(201);
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
    await prisma.order.deleteMany({ where: { requestId: { in: extraRequestIds } } });
    await prisma.offer.deleteMany({ where: { requestId: { in: extraRequestIds } } });
    await prisma.marketplaceRequest.deleteMany({ where: { id: { in: extraRequestIds } } });
    await prisma.order.deleteMany({ where: { requestId: { in: [requestA, requestB] } } });
    await prisma.offer.deleteMany({ where: { requestId: { in: [requestA, requestB] } } });
    await prisma.marketplaceRequest.deleteMany({ where: { id: { in: [requestA, requestB] } } });
    await Promise.all(uploadedPhotos.map((photo) => deletePrivateRequestImage(photo.clientId, photo.storageName)));
    await prisma.requestImage.deleteMany({ where: { id: { in: uploadedPhotos.map((photo) => photo.id) } } });
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

  it('accepts typed categories and requires an explicit reference status and client-selected location', async () => {
    const missingReferenceStatus = await agentA.post('/api/v1/client/requests').set('Idempotency-Key', randomUUID())
      .send({ vehicleMake: 'Peugeot', vehicleModel: '208', governorate: 'Tunis', category: 'Brakes', partName: 'Front pads', location: 'Tunis' }).expect(400);
    expect(missingReferenceStatus.body.error.code).toBe('VALIDATION_ERROR');
    await submitRequest(agentA, { partName: 'Contradictory reference', category: categoryA, quantity: 1, location: 'Tunis', oemReference: 'AB-123', referenceUnavailable: true }).expect(400);
    const customCategory = await submitRequest(agentA, { partName: 'Brake pads', category: `Custom category ${suffix}`, quantity: 1, location: 'Tunis', oemReference: 'AB-123' }).expect(201);
    extraRequestIds.push(customCategory.body.data.id);
    expect(customCategory.body.data.category).toBe(`Custom category ${suffix}`);
    expect(customCategory.body.data.oemReference).toBe('AB-123');
    expect(customCategory.body.data.referenceUnavailable).toBe(false);
    const normalizedCategory = await submitRequest(agentA, { partName: 'Oil filter', category: categoryA.toLowerCase(), quantity: 1, location: 'Tunis' }).expect(201);
    extraRequestIds.push(normalizedCategory.body.data.id);
    expect(normalizedCategory.body.data.category).toBe(categoryA);
    await submitRequest(agentA, { partName: 'Brake pads', category: categoryA, quantity: 1, location: 'Tunis', description: 'Contact me at buyer@example.test' }).expect(422)
      .expect(({ body }) => expect(body.error.code).toBe('CONTACT_DETAILS_NOT_ALLOWED'));
    await submitRequest(agentA, { partName: 'Contact seller at +21622345678', category: categoryA, quantity: 1, location: 'Tunis' }).expect(422)
      .expect(({ body }) => expect(body.error.code).toBe('CONTACT_DETAILS_NOT_ALLOWED'));
    await submitRequest(agentA, { partName: 'Missing location', category: categoryA, quantity: 1, location: undefined }).expect(400);
    await submitRequest(agentA, { partName: 'Missing vehicle make', category: categoryA, quantity: 1, location: 'Tunis', vehicleMake: '   ' }).expect(400);
    await submitRequest(agentA, { partName: 'Invalid governorate', category: categoryA, quantity: 1, location: 'Tunis', governorate: 'Not a governorate' }).expect(400);
    await submitRequest(agentA, { partName: 'Missing vehicle model', category: categoryA, quantity: 1, location: 'Tunis', vehicleModel: '   ' }).expect(400);
    await submitRequest(agentA, { partName: 'Invalid quantity', category: categoryA, quantity: 0, location: 'Tunis' }).expect(400);
    await submitRequest(agentA, { partName: 'Invalid budget', category: categoryA, quantity: 1, minBudget: 500, maxBudget: 100, location: 'Tunis' }).expect(400);
    await submitRequest(agentA, { partName: 'Invalid vehicle year', category: categoryA, quantity: 1, vehicleYear: 1800, location: 'Tunis' }).expect(400);
    const freeText = await submitRequest(agentA, { partName: 'Rare part: alternator pulley bracket', category: categoryA, quantity: 1, location: 'A small town', governorate: 'Sousse' }).expect(201);
    extraRequestIds.push(freeText.body.data.id);
    expect(freeText.body.data.vehicleMake).toBe('Unlisted Make');
    expect(freeText.body.data.vehicleModel).toBe('Model Z');
    const active = await agentA.get('/api/v1/client/categories').expect(200);
    expect(active.body.data.some((category: { name: string }) => category.name === categoryA)).toBe(true);
    await prisma.marketplaceCategory.update({ where: { id: categoryIds[1] }, data: { isActive: false } });
    const noReference = await submitRequest(agentB, { partName: 'Part without known reference', category: categoryB, quantity: 1, location: 'Sfax', governorate: 'Sfax', referenceUnavailable: true }).expect(201);
    extraRequestIds.push(noReference.body.data.id);
    expect(noReference.body.data.referenceUnavailable).toBe(true);
    expect(noReference.body.data.oemReference).toBeNull();
  });

  it('stores request photos privately and restricts reads to the owning Client', async () => {
    const imageBytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p3sAAAAASUVORK5CYII=', 'base64');
    const staged = await agentA.post('/api/v1/client/request-photos')
      .set('Content-Type', 'image/png')
      .set('X-File-Name', 'brake-part.png')
      .send(imageBytes)
      .expect(201);
    const imageRecord = await prisma.requestImage.findUniqueOrThrow({ where: { id: staged.body.data.id }, select: { storageName: true } });
    uploadedPhotos.push({ clientId: clientA, storageName: imageRecord.storageName, id: staged.body.data.id });
    await agentB.delete(`/api/v1/client/request-photos/${staged.body.data.id}`).expect(404);
    const created = await submitRequest(agentA, {
      partName: 'Photo evidence part', category: categoryA, quantity: 1, location: 'Tunis',
      photoIds: [staged.body.data.id],
    }).expect(201);
    extraRequestIds.push(created.body.data.id);
    expect(created.body.data.images).toHaveLength(1);
    expect(created.body.data.images[0]).toMatchObject({ id: staged.body.data.id, originalName: 'brake-part.png', mimeType: 'image/png' });
    const ownImage = await agentA.get(`/api/v1/client/requests/${created.body.data.id}/images/${staged.body.data.id}`).expect(200);
    expect(ownImage.headers['content-type']).toBe('image/png');
    expect(ownImage.headers['cache-control']).toBe('private, no-store');
    await agentB.get(`/api/v1/client/requests/${created.body.data.id}/images/${staged.body.data.id}`).expect(404);
    await request(app).get(`/api/v1/client/requests/${created.body.data.id}/images/${staged.body.data.id}`).expect(401);
  });

  it('replays a duplicate request submission with the same idempotency key', async () => {
    const key = randomUUID();
    const data = { partName: 'Idempotent part request', category: categoryA, quantity: 1, location: 'Sousse', governorate: 'Sousse', vehicleMake: 'Unknown Make', vehicleModel: 'Unlisted Model' };
    const first = await agentA.post('/api/v1/client/requests').set('Idempotency-Key', key).send(data).expect(201);
    extraRequestIds.push(first.body.data.id);
    const replay = await agentA.post('/api/v1/client/requests').set('Idempotency-Key', key).send(data).expect(200);
    expect(replay.body.data.id).toBe(first.body.data.id);
    await agentA.post('/api/v1/client/requests').set('Idempotency-Key', key).send({ ...data, partName: 'Different part' }).expect(409)
      .expect(({ body }) => expect(body.error.code).toBe('IDEMPOTENCY_KEY_REUSED'));
    await agentA.post('/api/v1/client/requests').send(data).expect(400);
  });

  it('enforces direct-contact restrictions on Client message submissions', async () => {
    await agentA.post(`/api/v1/client/conversations/${conversationA}/messages`).send({ body: 'Email me at buyer@example.test' }).expect(422)
      .expect(({ body }) => expect(body.error.code).toBe('CONTACT_DETAILS_NOT_ALLOWED'));
    await agentA.post(`/api/v1/client/conversations/${conversationA}/messages`).send({ body: 'The OEM reference is 123-456-78.' }).expect(201);
    const previous = await prisma.platformSetting.findUnique({ where: { key: 'restrictDirectContact' } });
    try {
      await prisma.platformSetting.upsert({ where: { key: 'restrictDirectContact' }, create: { key: 'restrictDirectContact', value: false }, update: { value: false } });
      await agentA.post(`/api/v1/client/conversations/${conversationA}/messages`).send({ body: 'Contact me at buyer@example.test' }).expect(201);
    } finally {
      if (previous) await prisma.platformSetting.update({ where: { key: previous.key }, data: { value: previous.value } });
      else await prisma.platformSetting.deleteMany({ where: { key: 'restrictDirectContact' } });
    }
  });

  it('cancels requests transactionally and invalidates pending offers with Seller notifications', async () => {
    const empty = await submitRequest(agentA, { partName: 'No offers request', category: categoryA, quantity: 1, location: 'Tunis' }).expect(201);
    extraRequestIds.push(empty.body.data.id);
    await agentA.post(`/api/v1/client/requests/${empty.body.data.id}/cancel`).expect(200);
    await agentA.post(`/api/v1/client/requests/${empty.body.data.id}/cancel`).expect(409);

    const withOffers = await submitRequest(agentA, { partName: 'Request with pending offers', category: categoryA, quantity: 1, location: 'Tunis' }).expect(201);
    const cancellationRequestId = withOffers.body.data.id as string;
    extraRequestIds.push(cancellationRequestId);
    const offers = await Promise.all([
      prisma.offer.create({ data: { sellerId, requestId: cancellationRequestId, partName: 'Offer one', condition: 'NEW', price: 10 } }),
      prisma.offer.create({ data: { sellerId: competingSellerId, requestId: cancellationRequestId, partName: 'Offer two', condition: 'NEW', price: 12 } }),
    ]);
    await prisma.marketplaceRequest.update({ where: { id: cancellationRequestId }, data: { status: 'OFFERS_RECEIVED' } });
    await agentA.post(`/api/v1/client/requests/${cancellationRequestId}/cancel`).expect(422)
      .expect(({ body }) => expect(body.error.code).toBe('CANCELLATION_REASON_REQUIRED'));
    const cancelled = await agentA.post(`/api/v1/client/requests/${cancellationRequestId}/cancel`).send({ reason: 'Found the part elsewhere' }).expect(200);
    expect((await prisma.marketplaceRequest.findUniqueOrThrow({ where: { id: cancellationRequestId } })).cancellationReason).toBe('Found the part elsewhere');
    expect(cancelled.body.data.status).toBe('CANCELLED');
    expect(await prisma.offer.count({ where: { id: { in: offers.map((offer) => offer.id) }, status: 'REJECTED' } })).toBe(2);
    expect(await prisma.notification.count({ where: { userId: { in: [sellerId, competingSellerId] }, type: 'request_cancelled', link: { startsWith: '/seller/offers/' } } })).toBeGreaterThanOrEqual(2);
    expect((await prisma.marketplaceRequest.findUniqueOrThrow({ where: { id: cancellationRequestId } })).status).toBe('CANCELLED');
  });

  it('serializes cancellation against an offer acceptance', async () => {
    const created = await submitRequest(agentA, { partName: 'Concurrent cancel and accept', category: categoryA, quantity: 1, location: 'Tunis' }).expect(201);
    const concurrentRequestId = created.body.data.id as string;
    extraRequestIds.push(concurrentRequestId);
    const offer = await prisma.offer.create({ data: { sellerId, requestId: concurrentRequestId, partName: 'Concurrent offer', condition: 'NEW', price: 34 } });
    const [cancelResponse, acceptResponse] = await Promise.all([
      agentA.post(`/api/v1/client/requests/${concurrentRequestId}/cancel`),
      agentA.post(`/api/v1/client/offers/${offer.id}/accept`),
    ]);
    expect([cancelResponse.status, acceptResponse.status].filter((status) => status === 200 || status === 201)).toHaveLength(1);
    expect([cancelResponse.status, acceptResponse.status].filter((status) => status === 409)).toHaveLength(1);
    const finalRequest = await prisma.marketplaceRequest.findUniqueOrThrow({ where: { id: concurrentRequestId } });
    const [orders, finalOffer] = await Promise.all([
      prisma.order.findMany({ where: { requestId: concurrentRequestId } }),
      prisma.offer.findUniqueOrThrow({ where: { id: offer.id } }),
    ]);
    if (finalRequest.status === 'CANCELLED') {
      expect(orders).toHaveLength(0);
      expect(finalOffer.status).toBe('REJECTED');
    } else {
      expect(finalRequest.status).toBe('OFFER_ACCEPTED');
      expect(orders).toHaveLength(1);
      expect(finalOffer.status).toBe('ACCEPTED');
    }
  });

  it('keeps competing offers while a selected order is provisional, then reopens them if cancelled', async () => {
    const responses = await Promise.all([
      agentA.post(`/api/v1/client/offers/${offerA1}/accept`),
      agentA.post(`/api/v1/client/offers/${offerA2}/accept`),
    ]);
    expect(responses.filter(r => r.status === 201)).toHaveLength(1);
    expect(responses.filter(r => r.status === 409)).toHaveLength(1);
    const [orders, acceptedOffers, pendingOffers, marketplaceRequest] = await Promise.all([
      prisma.order.findMany({ where: { requestId: requestA } }),
      prisma.offer.findMany({ where: { requestId: requestA, status: 'ACCEPTED' } }),
      prisma.offer.findMany({ where: { requestId: requestA, status: 'PENDING' } }),
      prisma.marketplaceRequest.findUniqueOrThrow({ where: { id: requestA } }),
    ]);
    expect(orders).toHaveLength(1);
    const acceptedOffer = await prisma.offer.findFirstOrThrow({ where: { requestId: requestA, status: 'ACCEPTED' } });
    expect(Number(orders[0].totalAmount)).toBe(Number(acceptedOffer.price) * acceptedOffer.quantity + Number(acceptedOffer.deliveryFee));
    expect(acceptedOffers).toHaveLength(1);
    expect(pendingOffers).toHaveLength(1);
    expect(marketplaceRequest.status).toBe('OFFER_ACCEPTED');
    await agentA.post(`/api/v1/client/requests/${requestA}/cancel`).expect(409);
    await agentA.post(`/api/v1/client/orders/${orders[0].id}/cancel`).expect(200);
    const reopened = await prisma.marketplaceRequest.findUniqueOrThrow({ where: { id: requestA } });
    expect(reopened.status).toBe('OFFERS_RECEIVED');
    expect((await prisma.offer.findUniqueOrThrow({ where: { id: acceptedOffers[0].id } })).status).toBe('ACCEPTED');
    expect((await prisma.offer.findUniqueOrThrow({ where: { id: pendingOffers[0].id } })).status).toBe('PENDING');
    await agentA.post(`/api/v1/client/offers/${pendingOffers[0].id}/accept`).expect(201);
    expect(await prisma.order.count({ where: { requestId: requestA, status: { not: 'CANCELLED' } } })).toBe(1);
  });

  it('expires stale offers and sends a single reminder before expiry without deleting history', async () => {
    const created = await submitRequest(agentA, { partName: 'Offer lifecycle part', category: categoryA, quantity: 1, location: 'Tunis' }).expect(201);
    const requestId = created.body.data.id as string;
    extraRequestIds.push(requestId);
    const now = new Date();
    const expiring = await prisma.offer.create({ data: { sellerId, requestId, partName: 'Soon-expiring offer', condition: 'NEW', price: 25, expiresAt: new Date(now.getTime() + 60 * 60 * 1000) } });
    await cleanupOfferLifecycle(now);
    await cleanupOfferLifecycle(now);
    expect((await prisma.offer.findUniqueOrThrow({ where: { id: expiring.id } })).reminderSentAt).not.toBeNull();
    expect(await prisma.notification.count({ where: { userId: clientA, type: 'offer_expiring', link: `/client/offers/${expiring.id}` } })).toBe(1);
    await cleanupOfferLifecycle(new Date(now.getTime() + 2 * 60 * 60 * 1000));
    expect((await prisma.offer.findUniqueOrThrow({ where: { id: expiring.id } })).status).toBe('EXPIRED');
    expect(await prisma.offer.count({ where: { id: expiring.id } })).toBe(1);
  });

  it('restores the authenticated Client session and revokes it on logout', async () => {
    const me = await agentA.get('/api/v1/client/auth/me').expect(200);
    expect(me.body.data.id).toBe(clientA);
    await agentA.post('/api/v1/client/auth/logout').expect(204);
    await agentA.get('/api/v1/client/auth/me').expect(401);
    await agentA.get('/api/v1/client/requests').expect(401);
  });
});
