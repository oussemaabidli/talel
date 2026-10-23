import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { app } from '../src/app.js';
import { prisma } from '../src/db.js';

const integration = describe.skipIf(!process.env.TEST_DATABASE_URL);
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

integration('Client and Host support conversations', () => {
  let clientId = '';
  let otherClientId = '';
  let hostId = '';
  let sellerId = '';
  let conversationId = '';
  const clientAgent = request.agent(app);
  const otherClientAgent = request.agent(app);
  const hostAgent = request.agent(app);
  const sellerAgent = request.agent(app);

  beforeAll(async () => {
    const passwordHash = await bcrypt.hash('support-integration-password', 4);
    const [client, otherClient, host, seller] = await Promise.all([
      prisma.user.create({ data: { email: `support-client-${suffix}@example.test`, passwordHash, role: 'CLIENT', clientProfile: { create: { name: 'Support Client' } } } }),
      prisma.user.create({ data: { email: `support-other-${suffix}@example.test`, passwordHash, role: 'CLIENT', clientProfile: { create: { name: 'Other Client' } } } }),
      prisma.user.create({ data: { email: `support-host-${suffix}@example.test`, passwordHash, role: 'HOST' } }),
      prisma.user.create({ data: { email: `support-seller-${suffix}@example.test`, passwordHash, role: 'SELLER', profile: { create: { name: 'Support Seller', shopName: 'Support Seller' } } } }),
    ]);
    clientId = client.id; otherClientId = otherClient.id; hostId = host.id; sellerId = seller.id;
    await Promise.all([
      clientAgent.post('/api/v1/client/auth/login').send({ email: client.email, password: 'support-integration-password' }).expect(200),
      otherClientAgent.post('/api/v1/client/auth/login').send({ email: otherClient.email, password: 'support-integration-password' }).expect(200),
      hostAgent.post('/api/v1/host/auth/login').send({ email: host.email, password: 'support-integration-password' }).expect(200),
      sellerAgent.post('/api/v1/auth/login').send({ email: seller.email, password: 'support-integration-password' }).expect(200),
    ]);
  });

  afterAll(async () => {
    if (!clientId) return;
    await prisma.notification.deleteMany({ where: { userId: clientId, type: 'support_reply' } });
    await prisma.conversation.deleteMany({ where: { supportClientId: clientId } });
    await prisma.user.deleteMany({ where: { id: { in: [clientId, otherClientId, hostId, sellerId] } } });
  });

  it('creates an owner-scoped support thread and enables an authenticated Host reply', async () => {
    await clientAgent.get('/api/v1/client/support/conversation').expect(200).expect(({ body }) => expect(body.data).toBeNull());
    const started = await clientAgent.post('/api/v1/client/support/conversation').expect(200);
    expect(started.body.data.type).toBe('SUPPORT');
    conversationId = started.body.data.id;
    const duplicate = await clientAgent.post('/api/v1/client/support/conversation').expect(200);
    expect(duplicate.body.data.id).toBe(conversationId);

    await clientAgent.post('/api/v1/client/support/conversation/messages').send({ body: 'I need help with my account.' }).expect(201);
    const hostInbox = await hostAgent.get('/api/v1/host/support/conversations').expect(200);
    expect(hostInbox.body.data.map((row: { id: string }) => row.id)).toContain(conversationId);
    const hostReply = await hostAgent.post(`/api/v1/host/support/conversations/${conversationId}/messages`).send({ body: 'We can help with your account.' }).expect(201);
    expect(hostReply.body.data.sender.role).toBe('HOST');

    const history = await clientAgent.get('/api/v1/client/support/conversation/messages').expect(200);
    expect(history.body.data.map((row: { body: string }) => row.body)).toEqual(['I need help with my account.', 'We can help with your account.']);
    expect(history.body.data[1].sender.role).toBe('HOST');
    expect((await prisma.conversation.findUniqueOrThrow({ where: { id: conversationId } })).supportClientId).toBe(clientId);
    expect(await prisma.notification.count({ where: { userId: clientId, type: 'support_reply' } })).toBe(1);
  });

  it('prevents other Clients and Sellers from reading or replying in the Host support inbox', async () => {
    await otherClientAgent.get('/api/v1/client/support/conversation/messages').expect(200).expect(({ body }) => expect(body.data).toEqual([]));
    await otherClientAgent.post(`/api/v1/client/conversations/${conversationId}/messages`).send({ body: 'Not my thread' }).expect(404);
    await sellerAgent.get('/api/v1/host/support/conversations').expect(401);
    await sellerAgent.post(`/api/v1/host/support/conversations/${conversationId}/messages`).send({ body: 'Unauthorized reply' }).expect(401);
  });
});
