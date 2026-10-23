import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
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
  let reportRequestIds: string[] = [];
  let orderPaginationRequestIds: string[] = [];

  beforeAll(async () => {
    const passwordHash = await bcrypt.hash('integration-test-password', 4);
    const a = await prisma.user.create({ data: { email: email('seller-a'), passwordHash, profile: { create: { name: 'Seller A', shopName: 'Seller A Test Shop', verificationStatus: 'verified' } } } });
    const b = await prisma.user.create({ data: { email: email('seller-b'), passwordHash, profile: { create: { name: 'Seller B', shopName: 'Seller B Test Shop', verificationStatus: 'verified' } } } });
    const host = await prisma.user.create({ data: { email: email('host'), passwordHash, role: 'HOST' } });
    const pending = await prisma.user.create({ data: { email: email('seller-pending'), passwordHash, profile: { create: { name: 'Pending Seller', shopName: 'Pending Seller Test Shop', legalName: 'Pending Seller Legal Name', legalForm: 'SARL', address: '12 Test Street', city: 'Tunis', categories: ['Mechanical'], verificationStatus: 'pending_verification' } } } });
    const client = await prisma.user.create({ data: { email: email('client'), passwordHash, role: 'CLIENT', clientProfile: { create: { name: 'Messaging Test Client', phone: '+21622123456', address: '8 Test Avenue', city: 'Sfax', vehicles: [{ brand: 'Test Motors', model: 'Fixture', year: 2020 }] } } } });
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
    if (reportRequestIds.length) await prisma.marketplaceRequest.deleteMany({ where: { id: { in: reportRequestIds } } });
    if (orderPaginationRequestIds.length) await prisma.marketplaceRequest.deleteMany({ where: { id: { in: orderPaginationRequestIds } } });
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
    await agentA.post('/api/v1/seller/offers').send({ ...offerInput, warranty: 'Contact seller@example.test' }).expect(422)
      .expect(({ body }) => expect(body.error.code).toBe('CONTACT_DETAILS_NOT_ALLOWED'));
    await agentA.post('/api/v1/seller/offers').send({ ...offerInput, estimatedDelivery: 'WhatsApp me at @parts_shop' }).expect(422)
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

  it('returns Client and Seller registration details only to Host sessions', async () => {
    await agentA.get(`/api/v1/host/users/${testClientId}/registration`).expect(401);
    const client = await hostAgent.get(`/api/v1/host/users/${testClientId}/registration`).expect(200);
    expect(client.body.data).toMatchObject({
      role: 'CLIENT',
      clientProfile: { name: 'Messaging Test Client', address: '8 Test Avenue', city: 'Sfax' },
    });
    expect(client.body.data.clientProfile.vehicles).toEqual([{ brand: 'Test Motors', model: 'Fixture', year: 2020 }]);
    const seller = await hostAgent.get(`/api/v1/host/users/${pendingSellerId}/registration`).expect(200);
    expect(seller.body.data).toMatchObject({
      role: 'SELLER',
      profile: { legalName: 'Pending Seller Legal Name', legalForm: 'SARL', address: '12 Test Street', city: 'Tunis' },
    });
  });

  it('paginates Host orders while calculating exact all-row order-value aggregates', async () => {
    const [baselineCount, baseline] = await Promise.all([
      prisma.order.count(),
      prisma.order.aggregate({ _sum: { totalAmount: true }, where: { status: { not: 'CANCELLED' } } }),
    ]);
    const reportMonthStart = new Date();
    reportMonthStart.setUTCDate(1);
    reportMonthStart.setUTCHours(0, 0, 0, 0);
    const reportTo = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const reportRange = { createdAt: { gte: reportMonthStart, lte: reportTo } };
    const baselineReportOrders = await prisma.order.groupBy({ by: ['status'], where: reportRange, _count: { _all: true }, _sum: { totalAmount: true } });
    const baselineReportCount = baselineReportOrders.reduce((sum, row) => sum + row._count._all, 0);
    const baselineReportValue = baselineReportOrders.reduce((sum, row) => row.status === 'CANCELLED' ? sum : sum.add(row._sum.totalAmount ?? new Prisma.Decimal(0)), new Prisma.Decimal(0));
    const baselineCompletedValue = baselineReportOrders.find((row) => row.status === 'COMPLETED')?._sum.totalAmount ?? new Prisma.Decimal(0);
    const baselineCancelledValue = baselineReportOrders.find((row) => row.status === 'CANCELLED')?._sum.totalAmount ?? new Prisma.Decimal(0);
    const baselineCompletedCount = baselineReportOrders.find((row) => row.status === 'COMPLETED')?._count._all ?? 0;
    const baselineCancelledCount = baselineReportOrders.find((row) => row.status === 'CANCELLED')?._count._all ?? 0;
    const rows = Array.from({ length: 501 }, (_, index) => ({
      index,
      requestId: `audit-request-${suffix}-${index}`,
      offerId: `audit-offer-${suffix}-${index}`,
      orderId: `audit-order-${suffix}-${index}`,
      status: index === 500 ? 'CANCELLED' as const : index === 499 ? 'COMPLETED' as const : 'OFFER_ACCEPTED' as const,
      createdAt: new Date(Date.now() - (500 - index) * 1000),
    }));
    orderPaginationRequestIds = rows.map((row) => row.requestId);
    await prisma.marketplaceRequest.createMany({ data: rows.map((row) => ({ id: row.requestId, clientId: testClientId, partName: `Audit fixture ${row.index}`, category: 'Mechanical', description: 'Synthetic order pagination fixture' })) });
    await prisma.offer.createMany({ data: rows.map(({ index, offerId, requestId: fixtureRequestId }) => ({ id: offerId, sellerId: sellerA, requestId: fixtureRequestId, partName: `Audit fixture ${index}`, condition: 'NEW' as const, price: 1, quantity: 1 })) });
    await prisma.order.createMany({ data: rows.map((row) => ({ id: row.orderId, sellerId: sellerA, requestId: row.requestId, offerId: row.offerId, status: row.status, totalAmount: 1, createdAt: row.createdAt })) });

    const firstPage = await hostAgent.get('/api/v1/host/transactions?page=1&limit=100').expect(200);
    expect(firstPage.body.data.items).toHaveLength(100);
    expect(firstPage.body.data.pagination).toMatchObject({ page: 1, limit: 100, total: baselineCount + 501 });
    expect(firstPage.body.data.items.some((item: { status: string }) => item.status === 'CANCELLED')).toBe(true);
    expect(firstPage.body.data.totals.grossOrderValueTnd).toBe(new Prisma.Decimal(baseline._sum.totalAmount?.toString() ?? '0').plus(500).toString());
    expect(firstPage.body.data.totals.completedOrderValueTnd).toBe((await prisma.order.aggregate({ where: { status: 'COMPLETED' }, _sum: { totalAmount: true } }))._sum.totalAmount?.toString() ?? '0');
    const cancelledPage = await hostAgent.get('/api/v1/host/transactions?page=1&limit=100&status=CANCELLED').expect(200);
    expect(cancelledPage.body.data.items.length).toBeGreaterThanOrEqual(1);
    expect(cancelledPage.body.data.items.every((item: { status: string }) => item.status === 'CANCELLED')).toBe(true);

    expect(await prisma.order.count({ where: { id: { in: rows.map((row) => row.orderId) }, ...reportRange } })).toBe(501);
    const reportFixtures = Array.from({ length: 205 }, (_, index) => ({
      id: `audit-report-request-${suffix}-${index}`,
      clientId: testClientId,
      partName: 'Report bulk fixture part',
      category: `Report bulk fixture ${suffix}`,
      description: 'Synthetic report aggregation test request',
      status: 'PUBLISHED' as const,
      createdAt: new Date(),
    }));
    reportRequestIds = reportFixtures.map((fixture) => fixture.id);
    await prisma.marketplaceRequest.createMany({ data: reportFixtures });
    const reportFrom = reportMonthStart.toISOString();
    const reportUntil = reportTo.toISOString();
    const report = await hostAgent.get(`/api/v1/host/reports?from=${encodeURIComponent(reportFrom)}&to=${encodeURIComponent(reportUntil)}`).expect(200);
    expect(report.body.data.orders.count).toBe(baselineReportCount + 501);
    expect(report.body.data.orders.completedCount).toBe(baselineCompletedCount + 1);
    expect(report.body.data.orders.cancelledCount).toBe(baselineCancelledCount + 1);
    expect(report.body.data.orders.nonCancelledOrderValueTnd).toBe(baselineReportValue.plus(500).toString());
    expect(report.body.data.orders.completedOrderValueTnd).toBe(baselineCompletedValue.plus(1).toString());
    expect(report.body.data.orders.cancelledOrderValueTnd).toBe(baselineCancelledValue.plus(1).toString());
    expect(report.body.data.monthlyOrders.reduce((sum: number, row: { orderCount: number }) => sum + row.orderCount, 0)).toBe(report.body.data.orders.count);
    expect(report.body.data.requestsByCategory).toContainEqual({ name: `Report bulk fixture ${suffix}`, count: 205 });
    expect(report.body.data.popularParts).toContainEqual({ name: 'Report bulk fixture part', count: 205 });
    await hostAgent.get(`/api/v1/host/reports?from=${encodeURIComponent(reportUntil)}&to=${encodeURIComponent(reportFrom)}`).expect(400);
    const empty = await hostAgent.get('/api/v1/host/reports?from=2000-01-01T00%3A00%3A00.000Z&to=2000-01-02T00%3A00%3A00.000Z').expect(200);
    expect(empty.body.data.orders).toMatchObject({ count: 0, completedCount: 0, cancelledCount: 0, nonCancelledOrderValueTnd: '0', completedOrderValueTnd: '0', cancelledOrderValueTnd: '0' });
    expect(empty.body.data.monthlyOrders).toEqual([]);
    expect(empty.body.data.requestsByCategory).toEqual([]);
    expect(empty.body.data.popularParts).toEqual([]);
  });

  it('enforces the direct-contact setting on Seller message submissions', async () => {
    await agentB.post(`/api/v1/seller/conversations/${conversationId}/messages`).send({ body: 'Call +216 22 345 678' }).expect(422)
      .expect(({ body }) => expect(body.error.code).toBe('CONTACT_DETAILS_NOT_ALLOWED'));
    await agentB.post(`/api/v1/seller/conversations/${conversationId}/messages`).send({ body: 'Your order is being prepared.' }).expect(201);
    const previous = await prisma.platformSetting.findUnique({ where: { key: 'restrictDirectContact' } });
    try {
      await prisma.platformSetting.upsert({ where: { key: 'restrictDirectContact' }, create: { key: 'restrictDirectContact', value: false }, update: { value: false } });
      await agentB.post(`/api/v1/seller/conversations/${conversationId}/messages`).send({ body: 'Contact me at seller@example.test' }).expect(201);
    } finally {
      if (previous) await prisma.platformSetting.update({ where: { key: previous.key }, data: { value: previous.value } });
      else await prisma.platformSetting.deleteMany({ where: { key: 'restrictDirectContact' } });
    }
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
