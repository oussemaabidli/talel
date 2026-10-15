import { Router } from 'express';
import { z } from 'zod';
import { randomBytes, createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Prisma, PartCondition, RequestStatus } from '@prisma/client';
import { prisma } from '../db.js';
import { env } from '../config/env.js';
import { requireClient } from '../middleware/auth.js';

export const clientRouter = Router();
const email = z.string().trim().email().max(254).transform(v => v.toLowerCase());
const clientSignup = z.object({ email, password: z.string().min(10).max(128), name: z.string().trim().min(1).max(100), phone: z.string().trim().max(32).optional(), address: z.string().trim().max(300).optional(), city: z.string().trim().max(100).optional() });
const login = z.object({ email, password: z.string().min(1).max(128) });
const cookie = { httpOnly: true, signed: true, sameSite: 'strict' as const, secure: env.NODE_ENV === 'production', path: '/', maxAge: env.SESSION_TTL_DAYS * 86400000 };
const hash = (v: string) => createHash('sha256').update(v).digest('hex');
const publicUser = { id: true, email: true, role: true, isActive: true, clientProfile: { select: { name: true, phone: true, address: true, city: true, vehicles: true } } } as const;

clientRouter.post('/auth/register', async (req, res, next) => {
  try {
    const input = clientSignup.parse(req.body);
    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await prisma.user.create({ data: { email: input.email, phone: input.phone, passwordHash, role: 'CLIENT', clientProfile: { create: { name: input.name, phone: input.phone, address: input.address, city: input.city } } }, select: { id: true, email: true } });
    const raw = randomBytes(32).toString('base64url');
    await prisma.session.create({ data: { userId: user.id, tokenHash: hash(raw), expiresAt: new Date(Date.now() + cookie.maxAge) } });
    res.cookie('talel_session', raw, cookie).status(201).json({ data: { user: { ...user, role: 'CLIENT' } } });
  } catch (e) { next(e); }
});
clientRouter.post('/auth/login', async (req, res, next) => {
  try {
    const input = login.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true, email: true, passwordHash: true, role: true, isActive: true, clientProfile: { select: { name: true } } } });
    if (!user || user.role !== 'CLIENT' || !user.isActive || !(await bcrypt.compare(input.password, user.passwordHash))) return res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect.' } });
    const raw = randomBytes(32).toString('base64url');
    await prisma.session.create({ data: { userId: user.id, tokenHash: hash(raw), expiresAt: new Date(Date.now() + cookie.maxAge) } });
    res.cookie('talel_session', raw, cookie).json({ data: { user: { id: user.id, email: user.email, role: 'CLIENT', name: user.clientProfile?.name } } });
  } catch (e) { next(e); }
});
clientRouter.post('/auth/logout', async (req, res, next) => {
  try { const raw = req.signedCookies?.talel_session as string | undefined; if (raw) await prisma.session.deleteMany({ where: { tokenHash: hash(raw) } }); res.clearCookie('talel_session', { httpOnly: true, sameSite: 'strict', secure: env.NODE_ENV === 'production', path: '/' }).status(204).end(); } catch (e) { next(e); }
});
clientRouter.use(requireClient);
const id = (req: import('express').Request) => req.clientId!;
clientRouter.get('/auth/me', async (req, res, next) => { try { res.set('Cache-Control', 'private, no-store').json({ data: await prisma.user.findUnique({ where: { id: id(req) }, select: publicUser }) }); } catch (e) { next(e); } });

const profileInput = z.object({ name: z.string().trim().min(1).max(100), phone: z.string().trim().max(32).optional().nullable(), address: z.string().trim().max(300).optional().nullable(), city: z.string().trim().max(100).optional().nullable(), vehicles: z.array(z.object({ id: z.string().max(80).optional(), brand: z.string().trim().min(1).max(80), model: z.string().trim().min(1).max(80), year: z.number().int().min(1900).max(2100), engine: z.string().max(80).optional() })).max(30).optional() });
clientRouter.patch('/profile', async (req, res, next) => { try { const p = profileInput.parse(req.body); const data = await prisma.clientProfile.upsert({ where: { userId: id(req) }, create: { userId: id(req), ...p, vehicles: p.vehicles ?? [] }, update: { ...p, vehicles: p.vehicles ?? [] } }); res.json({ data }); } catch (e) { next(e); } });

const requestInput = z.object({ partName: z.string().trim().min(1).max(160), category: z.string().trim().min(1).max(80), oemReference: z.string().trim().max(100).optional(), brand: z.string().trim().max(100).optional(), vehicleMake: z.string().trim().max(80).optional(), vehicleModel: z.string().trim().max(80).optional(), vehicleYear: z.number().int().min(1900).max(2100).optional(), condition: z.nativeEnum(PartCondition).default(PartCondition.EITHER), quantity: z.number().int().min(1).max(10000).default(1), minBudget: z.number().finite().nonnegative().max(999999999).optional(), maxBudget: z.number().finite().nonnegative().max(999999999).optional(), location: z.string().trim().max(150).optional(), deliveryMethod: z.enum(['delivery','pickup','both']).optional(), description: z.string().max(4000).optional() }).refine(v => v.minBudget === undefined || v.maxBudget === undefined || v.minBudget <= v.maxBudget, { message: 'Minimum budget must not exceed maximum budget.' });
const requestFields = { id: true, clientId: true, partName: true, category: true, oemReference: true, brand: true, vehicleMake: true, vehicleModel: true, vehicleYear: true, condition: true, quantity: true, minBudget: true, maxBudget: true, location: true, deliveryMethod: true, description: true, status: true, createdAt: true, updatedAt: true, _count: { select: { offers: true } } } as const;
clientRouter.get('/requests', async (req, res, next) => { try { const data = await prisma.marketplaceRequest.findMany({ where: { clientId: id(req) }, select: requestFields, orderBy: { createdAt: 'desc' } }); res.json({ data }); } catch (e) { next(e); } });
clientRouter.post('/requests', async (req, res, next) => { try { const p = requestInput.parse(req.body); const data = await prisma.marketplaceRequest.create({ data: { ...p, clientId: id(req), minBudget: p.minBudget === undefined ? undefined : new Prisma.Decimal(p.minBudget), maxBudget: p.maxBudget === undefined ? undefined : new Prisma.Decimal(p.maxBudget) }, select: requestFields }); res.status(201).json({ data }); } catch (e) { next(e); } });
clientRouter.get('/requests/:requestId', async (req, res, next) => {
  try {
    const data = await prisma.marketplaceRequest.findFirst({
      where: { id: req.params.requestId, clientId: id(req) },
      select: {
        ...requestFields,
        offers: {
          select: {
            id: true, sellerId: true, partName: true, brand: true, referenceNumber: true,
            condition: true, price: true, quantity: true, warranty: true, deliveryFee: true,
            estimatedDelivery: true, description: true, status: true, createdAt: true,
            seller: { select: { id: true, profile: { select: { shopName: true, verificationStatus: true, city: true } } } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!data) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Request not found.' } });
    res.json({ data });
  } catch (e) { next(e); }
});
clientRouter.patch('/requests/:requestId', async (req, res, next) => { try { const p = requestInput.partial().parse(req.body); const request = await prisma.marketplaceRequest.findFirst({ where: { id: req.params.requestId, clientId: id(req), status: RequestStatus.PUBLISHED, offers: { none: {} } }, select: { id: true } }); if (!request) return res.status(409).json({ error: { code: 'REQUEST_LOCKED', message: 'Only requests without offers can be edited.' } }); const data = await prisma.marketplaceRequest.update({ where: { id: request.id }, data: { ...p, ...(p.minBudget !== undefined ? { minBudget: new Prisma.Decimal(p.minBudget) } : {}), ...(p.maxBudget !== undefined ? { maxBudget: new Prisma.Decimal(p.maxBudget) } : {}) }, select: requestFields }); res.json({ data }); } catch (e) { next(e); } });
clientRouter.post('/requests/:requestId/cancel', async (req, res, next) => { try { const result = await prisma.marketplaceRequest.updateMany({ where: { id: req.params.requestId, clientId: id(req), status: { in: [RequestStatus.PUBLISHED, RequestStatus.OFFERS_RECEIVED] } }, data: { status: RequestStatus.CANCELLED } }); if (!result.count) return res.status(409).json({ error: { code: 'REQUEST_NOT_CANCELLABLE', message: 'This request can no longer be cancelled.' } }); res.json({ data: { id: req.params.requestId, status: RequestStatus.CANCELLED } }); } catch (e) { next(e); } });

clientRouter.get('/offers', async (req, res, next) => { try { const data = await prisma.offer.findMany({ where: { request: { clientId: id(req) } }, include: { seller: { select: { id: true, profile: { select: { shopName: true, verificationStatus: true, city: true } } } }, request: { select: { id: true, partName: true, category: true, vehicleMake: true, vehicleModel: true, vehicleYear: true } } }, orderBy: { createdAt: 'desc' } }); res.json({ data }); } catch (e) { next(e); } });
clientRouter.post('/offers/:offerId/conversation', async (req, res, next) => {
  try {
    const offer = await prisma.offer.findFirst({ where: { id: req.params.offerId, request: { clientId: id(req) } }, select: { sellerId: true, requestId: true } });
    if (!offer) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Offer not found.' } });
    const existing = await prisma.conversation.findFirst({ where: { requestId: offer.requestId, participants: { some: { userId: id(req) } }, AND: [{ participants: { some: { userId: offer.sellerId } } }] }, select: { id: true } });
    if (existing) return res.json({ data: existing });
    const conversation = await prisma.conversation.create({ data: { requestId: offer.requestId, participants: { create: [{ userId: id(req) }, { userId: offer.sellerId }] } }, select: { id: true } });
    res.status(201).json({ data: conversation });
  } catch (e) { next(e); }
});
clientRouter.post('/offers/:offerId/reject', async (req, res, next) => { try { const offer = await prisma.offer.findFirst({ where: { id: req.params.offerId, status: 'PENDING', request: { clientId: id(req), status: { in: ['PUBLISHED','OFFERS_RECEIVED'] } } }, select: { id: true, sellerId: true, partName: true } }); if (!offer) return res.status(409).json({ error: { code: 'OFFER_NOT_ACTIONABLE', message: 'This offer can no longer be rejected.' } }); const result = await prisma.$transaction(async tx => { const changed = await tx.offer.updateMany({ where: { id: offer.id, status: 'PENDING' }, data: { status: 'REJECTED' } }); if (!changed.count) return false; await tx.notification.create({ data: { userId: offer.sellerId, type: 'offer_rejected', title: 'Offer rejected', message: `The client rejected your offer for ${offer.partName}.`, link: `/seller/offers/${offer.id}` } }); return true; }); if (!result) return res.status(409).json({ error: { code: 'OFFER_NOT_ACTIONABLE', message: 'This offer can no longer be rejected.' } }); res.json({ data: { id: offer.id, status: 'REJECTED' } }); } catch (e) { next(e); } });
clientRouter.post('/offers/:offerId/accept', async (req, res, next) => {
  try {
    const order = await prisma.$transaction(async tx => {
      const offer = await tx.offer.findFirst({ where: { id: req.params.offerId, status: 'PENDING', request: { clientId: id(req), status: { in: ['PUBLISHED','OFFERS_RECEIVED'] } }, seller: { isActive: true, profile: { is: { verificationStatus: 'verified' } } } }, include: { request: true } });
      if (!offer) throw Object.assign(new Error('Offer is unavailable.'), { status: 409, code: 'OFFER_NOT_ACTIONABLE' });
      const claimed = await tx.marketplaceRequest.updateMany({ where: { id: offer.requestId, clientId: id(req), status: { in: [RequestStatus.PUBLISHED, RequestStatus.OFFERS_RECEIVED] } }, data: { status: RequestStatus.OFFER_ACCEPTED } });
      if (!claimed.count) throw Object.assign(new Error('Another offer was already accepted.'), { status: 409, code: 'OFFER_NOT_ACTIONABLE' });
      const accepted = await tx.offer.updateMany({ where: { id: offer.id, status: 'PENDING' }, data: { status: 'ACCEPTED' } });
      if (!accepted.count) throw Object.assign(new Error('Offer is no longer available.'), { status: 409, code: 'OFFER_NOT_ACTIONABLE' });
      await tx.offer.updateMany({ where: { requestId: offer.requestId, id: { not: offer.id }, status: 'PENDING' }, data: { status: 'REJECTED' } });
      const created = await tx.order.create({ data: { sellerId: offer.sellerId, requestId: offer.requestId, offerId: offer.id, totalAmount: offer.price.add(offer.deliveryFee), deliveryInfo: offer.request.location ?? '' }, include: { offer: true } });
      await tx.orderEvent.create({ data: { orderId: created.id, status: 'OFFER_ACCEPTED', note: 'Offer accepted by client.' } });
      const conversation = await tx.conversation.create({ data: { requestId: offer.requestId, orderId: created.id, participants: { create: [{ userId: id(req) }, { userId: offer.sellerId }] } } });
      await tx.notification.create({ data: { userId: offer.sellerId, type: 'offer_accepted', title: 'Offer accepted', message: 'The client accepted your offer.', link: `/seller/orders/${created.id}` } });
      return { ...created, conversationId: conversation.id };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    res.status(201).json({ data: order });
  } catch (e) { next(e); }
});

clientRouter.get('/orders', async (req, res, next) => { try { const data = await prisma.order.findMany({ where: { request: { clientId: id(req) } }, include: { offer: true, seller: { select: { id: true, profile: { select: { shopName: true } } } }, request: { select: { partName: true, location: true, deliveryMethod: true, quantity: true } }, events: { orderBy: { createdAt: 'asc' } } }, orderBy: { createdAt: 'desc' } }); res.json({ data }); } catch (e) { next(e); } });
clientRouter.get('/orders/:orderId', async (req, res, next) => { try { const data = await prisma.order.findFirst({ where: { id: req.params.orderId, request: { clientId: id(req) } }, include: { offer: true, seller: { select: { id: true, profile: { select: { shopName: true, city: true } } } }, request: true, events: { orderBy: { createdAt: 'asc' } } } }); if (!data) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Order not found.' } }); res.json({ data }); } catch (e) { next(e); } });
clientRouter.post('/orders/:orderId/cancel', async (req, res, next) => {
  try {
    const order = await prisma.$transaction(async tx => {
      const current = await tx.order.findFirst({ where: { id: req.params.orderId, request: { clientId: id(req) }, status: { in: ['OFFER_ACCEPTED','SELLER_CONFIRMED'] } }, select: { id: true, requestId: true, sellerId: true } });
      if (!current) throw Object.assign(new Error('This order is no longer eligible for cancellation.'), { code: 'ORDER_NOT_CANCELLABLE' });
      const updated = await tx.order.updateMany({ where: { id: current.id, status: { in: ['OFFER_ACCEPTED','SELLER_CONFIRMED'] } }, data: { status: 'CANCELLED' } });
      if (!updated.count) throw Object.assign(new Error('This order is no longer eligible for cancellation.'), { code: 'ORDER_NOT_CANCELLABLE' });
      await tx.marketplaceRequest.update({ where: { id: current.requestId }, data: { status: 'CANCELLED' } });
      await tx.orderEvent.create({ data: { orderId: current.id, status: 'CANCELLED', note: 'Cancellation requested by client.' } });
      await tx.notification.create({ data: { userId: current.sellerId, type: 'order_cancelled', title: 'Order cancelled', message: 'The client cancelled this order.', link: `/seller/orders/${current.id}` } });
      return tx.order.findUnique({ where: { id: current.id } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    res.json({ data: order });
  } catch (e) { next(e); }
});
clientRouter.get('/conversations', async (req, res, next) => {
  try {
    const data = await prisma.conversation.findMany({
      where: { participants: { some: { userId: id(req) } } },
      include: {
        request: { select: { id: true, partName: true } },
        order: { select: { id: true, status: true } },
        participants: { include: { user: { select: { id: true, role: true, clientProfile: { select: { name: true } }, profile: { select: { shopName: true, name: true } } } } } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ data });
  } catch (e) { next(e); }
});
clientRouter.get('/conversations/:conversationId/messages', async (req, res, next) => { try { const member = await prisma.conversationParticipant.findUnique({ where: { conversationId_userId: { conversationId: req.params.conversationId, userId: id(req) } } }); if (!member) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Conversation not found.' } }); res.json({ data: await prisma.message.findMany({ where: { conversationId: member.conversationId }, orderBy: { createdAt: 'asc' } }) }); } catch (e) { next(e); } });
clientRouter.post('/conversations/:conversationId/messages', async (req, res, next) => { try { const { body } = z.object({ body: z.string().trim().min(1).max(4000) }).parse(req.body); const member = await prisma.conversationParticipant.findUnique({ where: { conversationId_userId: { conversationId: req.params.conversationId, userId: id(req) } } }); if (!member) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Conversation not found.' } }); res.status(201).json({ data: await prisma.message.create({ data: { conversationId: member.conversationId, senderId: id(req), body } }) }); } catch (e) { next(e); } });
clientRouter.get('/notifications', async (req, res, next) => { try { res.json({ data: await prisma.notification.findMany({ where: { userId: id(req) }, orderBy: { createdAt: 'desc' }, take: 100 }) }); } catch (e) { next(e); } });
clientRouter.patch('/notifications/read-all', async (req, res, next) => { try { const result = await prisma.notification.updateMany({ where: { userId: id(req), readAt: null }, data: { readAt: new Date() } }); res.json({ data: { updated: result.count } }); } catch (e) { next(e); } });
clientRouter.patch('/notifications/:notificationId/read', async (req, res, next) => { try { const result = await prisma.notification.updateMany({ where: { id: req.params.notificationId, userId: id(req) }, data: { readAt: new Date() } }); if (!result.count) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Notification not found.' } }); res.status(204).end(); } catch (e) { next(e); } });
