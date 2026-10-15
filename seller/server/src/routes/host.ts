import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import { z, ZodError } from 'zod';
import { OfferStatus, OrderStatus, Prisma, RequestStatus } from '@prisma/client';
import { prisma } from '../db.js';
import { env } from '../config/env.js';
import { requireHost } from '../middleware/auth.js';
import { readPrivateDocument } from '../documents/storage.js';

export const hostRouter = express.Router();
const emailSchema = z.string().trim().email().max(254).transform((value) => value.toLowerCase());
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const sessionCookie = { httpOnly: true, signed: true, sameSite: 'strict' as const, secure: env.NODE_ENV === 'production', path: '/', maxAge: env.SESSION_TTL_DAYS * 86400000 };
const hostId = (req: express.Request) => req.hostId!;
const hostLoginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false });

// Host accounts are provisioned out of band. There is intentionally no Host registration route.
hostRouter.post('/auth/login', hostLoginLimiter, async (req, res, next) => {
  try {
    const { email, password } = z.object({ email: emailSchema, password: z.string().min(1).max(128) }).parse(req.body);
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, passwordHash: true, role: true, isActive: true } });
    if (!user || user.role !== 'HOST' || !user.isActive || !(await bcrypt.compare(password, user.passwordHash))) return res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect.' } });
    const token = randomBytes(32).toString('base64url');
    await prisma.session.create({ data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + sessionCookie.maxAge) } });
    res.cookie('talel_session', token, sessionCookie).json({ data: { user: { id: user.id, email: user.email, role: user.role } } });
  } catch (error) { next(error); }
});

hostRouter.use(requireHost);
hostRouter.get('/auth/me', async (req, res, next) => {
  try { const user = await prisma.user.findUnique({ where: { id: hostId(req) }, select: { id: true, email: true, role: true } }); res.json({ data: user }); }
  catch (error) { next(error); }
});

hostRouter.get('/dashboard', async (_req, res, next) => {
  try {
    const [users, clients, sellers, pendingSellers, requests, offers, orders, completedOrders, gmv, recentOrders, categories, recentActivity] = await Promise.all([
      prisma.user.count({ where: { role: { in: ['CLIENT', 'SELLER'] } } }),
      prisma.user.count({ where: { role: 'CLIENT', isActive: true } }),
      prisma.user.count({ where: { role: 'SELLER', isActive: true, profile: { verificationStatus: 'verified' } } }),
      prisma.sellerProfile.count({ where: { verificationStatus: 'pending_verification' } }),
      prisma.marketplaceRequest.count(), prisma.offer.count(), prisma.order.count(),
      prisma.order.count({ where: { status: OrderStatus.COMPLETED } }),
      prisma.order.aggregate({ _sum: { totalAmount: true } }),
      prisma.order.findMany({ take: 8, orderBy: { createdAt: 'desc' }, include: { request: true, offer: { include: { seller: { include: { profile: true } } } } } }),
      prisma.marketplaceCategory.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
      prisma.hostAuditLog.findMany({ take: 8, orderBy: { createdAt: 'desc' }, include: { actor: { select: { email: true } } } }),
    ]);
    const categoryCounts = await prisma.marketplaceRequest.groupBy({ by: ['category'], _count: { _all: true }, orderBy: { _count: { category: 'desc' } }, take: 8 });
    res.json({ data: { users, clients, sellers, pendingSellers, requests, offers, orders, completedOrders, gmvTnd: gmv._sum.totalAmount?.toString() ?? '0', recentOrders: recentOrders.map((order) => ({ ...order, sellerName: order.offer.seller.profile?.shopName ?? order.offer.seller.email, clientId: order.request.clientId })), categories: categoryCounts.map((item) => ({ name: item.category, value: item._count._all })), recentActivity } });
  } catch (error) { next(error); }
});

hostRouter.get('/users', async (req, res, next) => {
  try {
    const role = z.enum(['CLIENT', 'SELLER']).optional().parse(req.query.role);
    const search = z.string().trim().max(100).optional().parse(req.query.search);
    const page = z.coerce.number().int().min(1).default(1).parse(req.query.page);
    const limit = z.coerce.number().int().min(1).max(100).default(50).parse(req.query.limit);
    const where: Prisma.UserWhereInput = { role: role ?? { in: ['CLIENT', 'SELLER'] }, ...(search ? { OR: [{ email: { contains: search, mode: 'insensitive' } }, { profile: { is: { OR: [{ name: { contains: search, mode: 'insensitive' } }, { shopName: { contains: search, mode: 'insensitive' } }] } } }] } : {}) };
    const [data, total] = await Promise.all([prisma.user.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' }, select: { id: true, email: true, phone: true, role: true, isActive: true, createdAt: true, profile: true, _count: { select: { orders: true, offers: true } } } }), prisma.user.count({ where })]);
    res.json({ data, pagination: { page, limit, total } });
  } catch (error) { next(error); }
});

hostRouter.patch('/users/:id/status', async (req, res, next) => {
  try {
    const { isActive } = z.object({ isActive: z.boolean() }).parse(req.body);
    if (req.params.id === hostId(req)) return res.status(409).json({ error: { code: 'SELF_MODERATION', message: 'You cannot change your own Host account status.' } });
    const target = await prisma.user.findFirst({ where: { id: req.params.id, role: { in: ['CLIENT', 'SELLER'] } }, select: { id: true, isActive: true, role: true } });
    if (!target) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Client or seller account not found.' } });
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: target.id }, data: { isActive } });
      if (!isActive) await tx.session.deleteMany({ where: { userId: target.id } });
      await tx.hostAuditLog.create({ data: { actorId: hostId(req), action: isActive ? 'USER_ACTIVATED' : 'USER_SUSPENDED', entityType: 'user', entityId: target.id, details: { role: target.role } } });
    });
    res.json({ data: { id: target.id, isActive } });
  } catch (error) { next(error); }
});

hostRouter.get('/sellers', async (req, res, next) => {
  try {
    const status = z.enum(['pending_verification', 'verified', 'rejected']).optional().parse(req.query.status);
    const search = z.string().trim().max(100).optional().parse(req.query.search);
    const sellers = await prisma.user.findMany({ where: { role: 'SELLER', ...(search ? { OR: [{ email: { contains: search, mode: 'insensitive' } }, { profile: { is: { shopName: { contains: search, mode: 'insensitive' } } } }] } : {}), ...(status ? { profile: { is: { verificationStatus: status } } } : {}) }, orderBy: { createdAt: 'desc' }, take: 200, select: { id: true, email: true, phone: true, isActive: true, createdAt: true, profile: true } });
    const completedOrders = sellers.length ? await prisma.order.groupBy({ by: ['sellerId'], where: { sellerId: { in: sellers.map((seller) => seller.id) }, status: OrderStatus.COMPLETED }, _count: { _all: true }, _sum: { totalAmount: true } }) : [];
    res.json({ data: sellers.map((seller) => ({ ...seller, _count: { orders: completedOrders.find((row) => row.sellerId === seller.id)?._count._all ?? 0 }, completedRevenueTnd: completedOrders.find((row) => row.sellerId === seller.id)?._sum.totalAmount?.toString() ?? '0' })) });
  } catch (error) { next(error); }
});

hostRouter.patch('/sellers/:id/verification', async (req, res, next) => {
  try {
    const input = z.object({ status: z.enum(['verified', 'rejected', 'pending_verification']), rejectionReason: z.string().trim().min(1).max(1000).optional() }).refine((value) => value.status !== 'rejected' || !!value.rejectionReason, { message: 'A reason is required when rejecting a seller.' }).parse(req.body);
    const { status } = input;
    const profile = await prisma.sellerProfile.findFirst({ where: { userId: req.params.id, user: { role: 'SELLER' } }, select: { userId: true, verificationStatus: true } });
    if (!profile) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Seller profile not found.' } });
    if (status === 'verified') {
      const documents = await prisma.sellerDocument.findMany({ where: { sellerId: profile.userId }, select: { kind: true, status: true } });
      if (!documents.some((document) => document.kind === 'addressDoc' && document.status === 'approved') || documents.some((document) => document.status !== 'approved')) return res.status(409).json({ error: { code: 'DOCUMENT_REVIEW_REQUIRED', message: 'Approve the professional address document and review every submitted document before verifying this seller.' } });
    }
    await prisma.$transaction(async (tx) => {
      await tx.sellerProfile.update({ where: { userId: profile.userId }, data: { verificationStatus: status, verificationRejectionReason: status === 'rejected' ? input.rejectionReason : null } });
      await tx.hostAuditLog.create({ data: { actorId: hostId(req), action: 'SELLER_VERIFICATION_CHANGED', entityType: 'seller', entityId: profile.userId, details: { from: profile.verificationStatus, to: status, rejectionReason: input.rejectionReason ?? null } } });
    });
    res.json({ data: { userId: profile.userId, verificationStatus: status } });
  } catch (error) { next(error); }
});

hostRouter.get('/sellers/:id/documents', async (req, res, next) => {
  try {
    const seller = await prisma.user.findFirst({ where: { id: req.params.id, role: 'SELLER' }, select: { id: true } });
    if (!seller) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Seller not found.' } });
    const data = await prisma.sellerDocument.findMany({ where: { sellerId: seller.id }, select: { id: true, kind: true, originalName: true, mimeType: true, size: true, status: true, rejectionReason: true, submittedAt: true, reviewedAt: true, reviewer: { select: { email: true } } }, orderBy: { submittedAt: 'desc' } });
    res.set('Cache-Control', 'private, no-store').json({ data });
  } catch (error) { next(error); }
});

hostRouter.get('/sellers/:sellerId/documents/:documentId/file', async (req, res, next) => {
  try {
    const document = await prisma.sellerDocument.findFirst({ where: { id: req.params.documentId, sellerId: req.params.sellerId }, select: { storageName: true, originalName: true, mimeType: true, sellerId: true } });
    if (!document) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Document not found.' } });
    const bytes = await readPrivateDocument(document.sellerId, document.storageName);
    res.set({ 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Disposition': `attachment; filename="document"; filename*=UTF-8''${encodeURIComponent(document.originalName)}` }).type(document.mimeType).send(bytes);
  } catch (error) { next(error); }
});

hostRouter.patch('/sellers/:sellerId/documents/:documentId/review', async (req, res, next) => {
  try {
    const input = z.object({ status: z.enum(['approved', 'rejected']), rejectionReason: z.string().trim().min(1).max(1000).optional() }).refine((value) => value.status !== 'rejected' || !!value.rejectionReason, { message: 'A reason is required when rejecting a document.' }).parse(req.body);
    const document = await prisma.sellerDocument.findFirst({ where: { id: req.params.documentId, sellerId: req.params.sellerId }, select: { id: true, sellerId: true, kind: true, status: true } });
    if (!document) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Document not found.' } });
    const data = await prisma.$transaction(async (tx) => {
      const updated = await tx.sellerDocument.update({ where: { id: document.id }, data: { status: input.status, rejectionReason: input.status === 'rejected' ? input.rejectionReason : null, reviewerId: hostId(req), reviewedAt: new Date() }, select: { id: true, sellerId: true, kind: true, status: true, rejectionReason: true, reviewedAt: true } });
      await tx.hostAuditLog.create({ data: { actorId: hostId(req), action: input.status === 'approved' ? 'SELLER_DOCUMENT_APPROVED' : 'SELLER_DOCUMENT_REJECTED', entityType: 'seller_document', entityId: document.id, details: { sellerId: document.sellerId, kind: document.kind, from: document.status, to: input.status, rejectionReason: input.rejectionReason ?? null } } });
      if (input.status === 'rejected') await tx.sellerProfile.update({ where: { userId: document.sellerId }, data: { verificationStatus: 'rejected', verificationRejectionReason: input.rejectionReason } });
      return updated;
    });
    res.json({ data });
  } catch (error) { next(error); }
});

hostRouter.get('/requests', async (_req, res, next) => {
  try { res.json({ data: await prisma.marketplaceRequest.findMany({ take: 200, orderBy: { createdAt: 'desc' }, include: { _count: { select: { offers: true } } } }) }); }
  catch (error) { next(error); }
});
hostRouter.get('/offers', async (_req, res, next) => {
  try { res.json({ data: await prisma.offer.findMany({ take: 200, orderBy: { createdAt: 'desc' }, include: { seller: { include: { profile: true } }, request: true } }) }); }
  catch (error) { next(error); }
});
hostRouter.get('/orders', async (_req, res, next) => {
  try { res.json({ data: await prisma.order.findMany({ take: 200, orderBy: { createdAt: 'desc' }, include: { offer: { include: { seller: { include: { profile: true } } } }, request: true, events: { orderBy: { createdAt: 'asc' } } } }) }); }
  catch (error) { next(error); }
});
hostRouter.get('/transactions', async (_req, res, next) => {
  try {
    const orders = await prisma.order.findMany({ take: 500, orderBy: { createdAt: 'desc' }, include: { request: true, offer: { include: { seller: { include: { profile: true } } } } } });
    res.json({ data: orders.map((order) => ({ id: order.id, orderId: order.id, clientId: order.request.clientId, sellerId: order.sellerId, sellerName: order.offer.seller.profile?.shopName ?? order.offer.seller.email, amountTnd: order.totalAmount.toString(), status: order.status, createdAt: order.createdAt })) });
  } catch (error) { next(error); }
});
hostRouter.get('/activity', async (_req, res, next) => {
  try { res.json({ data: await prisma.hostAuditLog.findMany({ take: 250, orderBy: { createdAt: 'desc' }, include: { actor: { select: { email: true } } } }) }); }
  catch (error) { next(error); }
});

hostRouter.get('/categories', async (_req, res, next) => {
  try {
    const data = await prisma.marketplaceCategory.findMany({ orderBy: { name: 'asc' } });
    const counts = await prisma.marketplaceRequest.groupBy({ by: ['category'], _count: { _all: true } });
    res.json({ data: data.map((category) => ({ ...category, partCount: counts.find((row) => row.category === category.name)?._count._all ?? 0 })) });
  } catch (error) { next(error); }
});
const categorySchema = z.object({ name: z.string().trim().min(1).max(80), description: z.string().max(500).default(''), icon: z.string().trim().min(1).max(40).default('box'), isActive: z.boolean().default(true) });
hostRouter.post('/categories', async (req, res, next) => {
  try {
    const input = categorySchema.parse(req.body);
    const data = await prisma.$transaction(async (tx) => {
      const category = await tx.marketplaceCategory.create({ data: input });
      await tx.hostAuditLog.create({ data: { actorId: hostId(req), action: 'CATEGORY_CREATED', entityType: 'category', entityId: category.id, details: { name: category.name } } });
      return category;
    });
    res.status(201).json({ data });
  } catch (error) { next(error); }
});
hostRouter.patch('/categories/:id', async (req, res, next) => {
  try {
    const input = categorySchema.partial().parse(req.body);
    const data = await prisma.$transaction(async (tx) => {
      const category = await tx.marketplaceCategory.update({ where: { id: req.params.id }, data: input });
      await tx.hostAuditLog.create({ data: { actorId: hostId(req), action: 'CATEGORY_UPDATED', entityType: 'category', entityId: category.id, details: input } });
      return category;
    });
    res.json({ data });
  } catch (error) { next(error); }
});
hostRouter.delete('/categories/:id', async (req, res, next) => {
  try {
    const category = await prisma.marketplaceCategory.findUnique({ where: { id: req.params.id }, select: { id: true, name: true } });
    if (!category) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Category not found.' } });
    const count = await prisma.marketplaceRequest.count({ where: { category: category.name } });
    if (count > 0) return res.status(409).json({ error: { code: 'CATEGORY_IN_USE', message: 'This category is used by marketplace requests; disable it instead.' } });
    await prisma.$transaction(async (tx) => {
      await tx.marketplaceCategory.delete({ where: { id: category.id } });
      await tx.hostAuditLog.create({ data: { actorId: hostId(req), action: 'CATEGORY_DELETED', entityType: 'category', entityId: category.id, details: { name: category.name } } });
    });
    res.status(204).end();
  } catch (error) { next(error); }
});

hostRouter.get('/settings', async (_req, res, next) => {
  try { res.json({ data: await prisma.platformSetting.findMany({ orderBy: { key: 'asc' } }) }); }
  catch (error) { next(error); }
});
hostRouter.patch('/settings/:key', async (req, res, next) => {
  try {
    const key = z.string().regex(/^[a-z][a-z0-9_.-]{1,80}$/).parse(req.params.key);
    const { value } = z.object({ value: z.union([z.string().max(2000), z.number().finite(), z.boolean(), z.array(z.string().max(200)), z.record(z.string(), z.unknown())]) }).parse(req.body);
    const data = await prisma.$transaction(async (tx) => {
      const setting = await tx.platformSetting.upsert({ where: { key }, create: { key, value: value as Prisma.InputJsonValue }, update: { value: value as Prisma.InputJsonValue } });
      await tx.hostAuditLog.create({ data: { actorId: hostId(req), action: 'SETTING_UPDATED', entityType: 'setting', entityId: key, details: { value } as Prisma.InputJsonValue } });
      return setting;
    });
    res.json({ data });
  } catch (error) { next(error); }
});
