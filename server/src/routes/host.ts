import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { OfferStatus, OrderStatus, Prisma, RequestStatus } from '@prisma/client';
import { prisma } from '../db.js';
import { env } from '../config/env.js';
import { requireHost } from '../middleware/auth.js';
import { readPrivateDocument } from '../documents/storage.js';
import { sellerDocumentsMeetPolicy } from '../documents/policy.js';
import { invalidateContactPolicyCache } from '../messaging/contactPolicy.js';

export const hostRouter = express.Router();
const emailSchema = z.string().trim().email().max(254).transform((value) => value.toLowerCase());
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const sessionCookie = { httpOnly: true, signed: true, sameSite: 'strict' as const, secure: env.NODE_ENV === 'production', path: '/', maxAge: env.SESSION_TTL_DAYS * 86400000 };
const hostId = (req: express.Request) => req.hostId!;
const hostLoginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false });
const hostActionLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 60, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: { code: 'RATE_LIMITED', message: 'Too many administrative changes. Try again later.' } } });

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
hostRouter.get('/support/conversations', async (_req, res, next) => {
  try {
    const conversations = await prisma.conversation.findMany({
      where: { type: 'SUPPORT' },
      include: {
        supportClient: { select: { id: true, email: true, clientProfile: { select: { name: true } } } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1, include: { sender: { select: { role: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    res.set('Cache-Control', 'private, no-store').json({ data: conversations });
  } catch (error) { next(error); }
});
hostRouter.get('/support/conversations/:id/messages', async (req, res, next) => {
  try {
    const conversationId = String(req.params.id);
    const conversation = await prisma.conversation.findFirst({ where: { id: conversationId, type: 'SUPPORT' }, select: { id: true } });
    if (!conversation) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Support conversation not found.' } });
    res.set('Cache-Control', 'private, no-store').json({ data: await prisma.message.findMany({ where: { conversationId }, orderBy: { createdAt: 'asc' }, take: 500, include: { sender: { select: { id: true, email: true, role: true, clientProfile: { select: { name: true } } } } } }) });
  } catch (error) { next(error); }
});
hostRouter.post('/support/conversations/:id/messages', hostActionLimiter, async (req, res, next) => {
  try {
    const { body } = z.object({ body: z.string().trim().min(1).max(4000) }).parse(req.body);
    const conversationId = String(req.params.id);
    const conversation = await prisma.conversation.findFirst({ where: { id: conversationId, type: 'SUPPORT' }, select: { id: true, supportClientId: true } });
    if (!conversation) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Support conversation not found.' } });
    const message = await prisma.$transaction(async (tx) => {
      await tx.conversationParticipant.upsert({ where: { conversationId_userId: { conversationId, userId: hostId(req) } }, create: { conversationId, userId: hostId(req) }, update: {} });
      const saved = await tx.message.create({ data: { conversationId, senderId: hostId(req), body }, include: { sender: { select: { id: true, email: true, role: true } } } });
      if (conversation.supportClientId) await tx.notification.create({ data: { userId: conversation.supportClientId, type: 'support_reply', title: 'Support replied', message: 'You have a new reply from Talel Support.', link: '/client/support' } });
      return saved;
    });
    res.status(201).json({ data: message });
  } catch (error) { next(error); }
});
hostRouter.get('/auth/me', async (req, res, next) => {
  try { const user = await prisma.user.findUnique({ where: { id: hostId(req) }, select: { id: true, email: true, role: true } }); res.json({ data: user }); }
  catch (error) { next(error); }
});

hostRouter.get('/dashboard', async (_req, res, next) => {
  try {
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    monthStart.setUTCMonth(monthStart.getUTCMonth() - 5);
    const monthEnd = new Date();
    monthEnd.setUTCDate(1);
    monthEnd.setUTCHours(0, 0, 0, 0);
    monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1);
    const [users, clients, sellers, pendingSellers, requests, offers, orders, completedOrders, cancelledOrders, activeOrderValue, completedOrderValue, cancelledOrderValue, recentOrders, categories, recentActivity, monthlyRows] = await Promise.all([
      prisma.user.count({ where: { role: { in: ['CLIENT', 'SELLER'] } } }),
      prisma.user.count({ where: { role: 'CLIENT', isActive: true } }),
      prisma.user.count({ where: { role: 'SELLER', isActive: true, profile: { verificationStatus: 'verified' } } }),
      prisma.sellerProfile.count({ where: { verificationStatus: 'pending_verification' } }),
      prisma.marketplaceRequest.count(), prisma.offer.count(), prisma.order.count(),
      prisma.order.count({ where: { status: OrderStatus.COMPLETED } }),
      prisma.order.count({ where: { status: OrderStatus.CANCELLED } }),
      prisma.order.aggregate({ where: { status: { not: OrderStatus.CANCELLED } }, _sum: { totalAmount: true } }),
      prisma.order.aggregate({ where: { status: OrderStatus.COMPLETED }, _sum: { totalAmount: true } }),
      prisma.order.aggregate({ where: { status: OrderStatus.CANCELLED }, _sum: { totalAmount: true } }),
      prisma.order.findMany({ take: 8, orderBy: { createdAt: 'desc' }, include: {
        request: { include: { client: { select: { email: true, clientProfile: { select: { name: true } } } } } },
        offer: { include: { seller: { include: { profile: true } } } },
      } }),
      prisma.marketplaceCategory.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
      prisma.hostAuditLog.findMany({ take: 8, orderBy: { createdAt: 'desc' }, include: { actor: { select: { email: true } } } }),
      prisma.$queryRaw<Array<{ month: Date; orderCount: number; orderValueTnd: Prisma.Decimal }>>(Prisma.sql`
        SELECT date_trunc('month', "createdAt") AS month,
          count(*)::int AS "orderCount",
          coalesce(sum("totalAmount") FILTER (WHERE "status" <> 'CANCELLED'), 0)::numeric AS "orderValueTnd"
        FROM "Order"
        WHERE "createdAt" >= ${monthStart} AND "createdAt" < ${monthEnd}
        GROUP BY date_trunc('month', "createdAt")
        ORDER BY month
      `),
    ]);
    const categoryCounts = await prisma.marketplaceRequest.groupBy({ by: ['category'], _count: { _all: true }, orderBy: { _count: { category: 'desc' } }, take: 8 });
    const rowsByMonth = new Map(monthlyRows.map((row) => [row.month.toISOString().slice(0, 7), row]));
    const monthlyOrderValue = Array.from({ length: 6 }, (_, index) => {
      const month = new Date(monthStart);
      month.setUTCMonth(month.getUTCMonth() + index);
      const key = month.toISOString().slice(0, 7);
      const row = rowsByMonth.get(key);
      return { month: key, orderCount: row?.orderCount ?? 0, nonCancelledOrderValueTnd: row?.orderValueTnd.toString() ?? '0' };
    });
    res.json({ data: {
      users, clients, sellers, pendingSellers, requests, offers, orders, completedOrders, cancelledOrders,
      nonCancelledOrderValueTnd: activeOrderValue._sum.totalAmount?.toString() ?? '0',
      completedOrderValueTnd: completedOrderValue._sum.totalAmount?.toString() ?? '0',
      cancelledOrderValueTnd: cancelledOrderValue._sum.totalAmount?.toString() ?? '0',
      recentOrders: recentOrders.map((order) => ({ ...order, sellerName: order.offer.seller.profile?.shopName ?? order.offer.seller.email, clientId: order.request.clientId })),
      categories: categoryCounts.map((item) => ({ name: item.category, value: item._count._all })),
      recentActivity, monthlyOrderValue,
    } });
  } catch (error) { next(error); }
});

const reportRangeSchema = z.object({ from: z.coerce.date(), to: z.coerce.date() })
  .refine(({ from, to }) => from <= to, { message: 'The start date must not be after the end date.' });

hostRouter.get('/reports', async (req, res, next) => {
  try {
    const { from, to } = reportRangeSchema.parse(req.query);
    const orderRange = { createdAt: { gte: from, lte: to } };
    const requestRange = { createdAt: { gte: from, lte: to } };
    const [ordersByStatus, monthlyRows, requestsByCategory, popularParts] = await Promise.all([
      prisma.order.groupBy({ by: ['status'], where: orderRange, _count: { _all: true }, _sum: { totalAmount: true } }),
      prisma.$queryRaw<Array<{ month: Date; orderCount: number; completedCount: number; cancelledCount: number; orderValueTnd: Prisma.Decimal; completedOrderValueTnd: Prisma.Decimal }>>(Prisma.sql`
        SELECT date_trunc('month', "createdAt") AS month,
          count(*)::int AS "orderCount",
          count(*) FILTER (WHERE "status" = 'COMPLETED')::int AS "completedCount",
          count(*) FILTER (WHERE "status" = 'CANCELLED')::int AS "cancelledCount",
          coalesce(sum("totalAmount") FILTER (WHERE "status" <> 'CANCELLED'), 0)::numeric AS "orderValueTnd",
          coalesce(sum("totalAmount") FILTER (WHERE "status" = 'COMPLETED'), 0)::numeric AS "completedOrderValueTnd"
        FROM "Order"
        WHERE "createdAt" >= ${from} AND "createdAt" <= ${to}
        GROUP BY date_trunc('month', "createdAt")
        ORDER BY month
      `),
      prisma.marketplaceRequest.groupBy({ by: ['category'], where: requestRange, _count: { _all: true }, orderBy: { _count: { category: 'desc' } } }),
      prisma.marketplaceRequest.groupBy({ by: ['partName'], where: requestRange, _count: { _all: true }, orderBy: [{ _count: { partName: 'desc' } }, { partName: 'asc' }], take: 8 }),
    ]);
    const statusRows = new Map(ordersByStatus.map((row) => [row.status, row]));
    const totalOrderCount = ordersByStatus.reduce((sum, row) => sum + row._count._all, 0);
    const activeOrderValue = ordersByStatus.reduce((sum, row) => row.status === OrderStatus.CANCELLED ? sum : sum.add(row._sum.totalAmount ?? new Prisma.Decimal(0)), new Prisma.Decimal(0));
    const completed = statusRows.get(OrderStatus.COMPLETED);
    const cancelled = statusRows.get(OrderStatus.CANCELLED);
    res.json({ data: {
      period: { from: from.toISOString(), to: to.toISOString() },
      orders: {
        count: totalOrderCount,
        completedCount: completed?._count._all ?? 0,
        cancelledCount: cancelled?._count._all ?? 0,
        nonCancelledOrderValueTnd: activeOrderValue.toString(),
        completedOrderValueTnd: completed?._sum.totalAmount?.toString() ?? '0',
        cancelledOrderValueTnd: cancelled?._sum.totalAmount?.toString() ?? '0',
      },
      monthlyOrders: monthlyRows.map((row) => ({
        month: row.month.toISOString().slice(0, 7), orderCount: row.orderCount,
        completedCount: row.completedCount, cancelledCount: row.cancelledCount,
        nonCancelledOrderValueTnd: row.orderValueTnd.toString(), completedOrderValueTnd: row.completedOrderValueTnd.toString(),
      })),
      requestsByCategory: requestsByCategory.map((row) => ({ name: row.category, count: row._count._all })),
      popularParts: popularParts.map((row) => ({ name: row.partName, count: row._count._all })),
    } });
  } catch (error) { next(error); }
});

hostRouter.get('/users', async (req, res, next) => {
  try {
    const role = z.enum(['CLIENT', 'SELLER']).optional().parse(req.query.role);
    const search = z.string().trim().max(100).optional().parse(req.query.search);
    const page = z.coerce.number().int().min(1).default(1).parse(req.query.page);
    const limit = z.coerce.number().int().min(1).max(100).default(50).parse(req.query.limit);
    const where: Prisma.UserWhereInput = {
      role: role ?? { in: ['CLIENT', 'SELLER'] },
      ...(search ? { OR: [
        { email: { contains: search, mode: 'insensitive' } },
        { profile: { is: { OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { shopName: { contains: search, mode: 'insensitive' } },
        ] } } },
        { clientProfile: { is: { name: { contains: search, mode: 'insensitive' } } } },
      ] } : {}),
    };
    const [data, total] = await Promise.all([prisma.user.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' }, select: { id: true, email: true, phone: true, role: true, isActive: true, createdAt: true, profile: true, clientProfile: true, _count: { select: { orders: true, offers: true } } } }), prisma.user.count({ where })]);
    res.json({ data, pagination: { page, limit, total } });
  } catch (error) { next(error); }
});

hostRouter.get('/users/:id/registration', async (req, res, next) => {
  try {
    const user = await prisma.user.findFirst({
      where: { id: String(req.params.id), role: { in: ['CLIENT', 'SELLER'] } },
      select: { id: true, email: true, phone: true, role: true, isActive: true, createdAt: true, clientProfile: true, profile: true },
    });
    if (!user) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Client or seller account not found.' } });
    res.set('Cache-Control', 'private, no-store').json({ data: user });
  } catch (error) { next(error); }
});

hostRouter.patch('/users/:id/status', hostActionLimiter, async (req, res, next) => {
  try {
    const { isActive } = z.object({ isActive: z.boolean() }).parse(req.body);
    if (String(req.params.id) === hostId(req)) return res.status(409).json({ error: { code: 'SELF_MODERATION', message: 'You cannot change your own Host account status.' } });
    const target = await prisma.user.findFirst({ where: { id: String(req.params.id), role: { in: ['CLIENT', 'SELLER'] } }, select: { id: true, isActive: true, role: true } });
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

hostRouter.patch('/sellers/:id/verification', hostActionLimiter, async (req, res, next) => {
  try {
    const input = z.object({ status: z.enum(['verified', 'rejected', 'pending_verification']), rejectionReason: z.string().trim().min(1).max(1000).optional() }).refine((value) => value.status !== 'rejected' || !!value.rejectionReason, { message: 'A reason is required when rejecting a seller.' }).parse(req.body);
    const { status } = input;
    const profile = await prisma.sellerProfile.findFirst({ where: { userId: String(req.params.id), user: { role: 'SELLER' } }, select: { userId: true, verificationStatus: true } });
    if (!profile) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Seller profile not found.' } });
    if (status === 'verified') {
      const documents = await prisma.sellerDocument.findMany({ where: { sellerId: profile.userId }, select: { kind: true, status: true } });
      if (!sellerDocumentsMeetPolicy(documents)) return res.status(409).json({ error: { code: 'DOCUMENT_REVIEW_REQUIRED', message: 'Approve the required professional address document and review every submitted document before verifying this seller.' } });
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
    const seller = await prisma.user.findFirst({ where: { id: String(req.params.id), role: 'SELLER' }, select: { id: true } });
    if (!seller) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Seller not found.' } });
    const data = await prisma.sellerDocument.findMany({ where: { sellerId: seller.id }, select: { id: true, kind: true, originalName: true, mimeType: true, size: true, status: true, rejectionReason: true, submittedAt: true, reviewedAt: true, reviewer: { select: { email: true } } }, orderBy: { submittedAt: 'desc' } });
    res.set('Cache-Control', 'private, no-store').json({ data });
  } catch (error) { next(error); }
});

hostRouter.get('/sellers/:sellerId/documents/:documentId/file', async (req, res, next) => {
  try {
    const document = await prisma.sellerDocument.findFirst({ where: { id: String(req.params.documentId), sellerId: String(req.params.sellerId) }, select: { storageName: true, originalName: true, mimeType: true, sellerId: true } });
    if (!document) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Document not found.' } });
    const bytes = await readPrivateDocument(document.sellerId, document.storageName);
    res.set({ 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Disposition': `attachment; filename="document"; filename*=UTF-8''${encodeURIComponent(document.originalName)}` }).type(document.mimeType).send(bytes);
  } catch (error) { next(error); }
});

hostRouter.patch('/sellers/:sellerId/documents/:documentId/review', hostActionLimiter, async (req, res, next) => {
  try {
    const input = z.object({ status: z.enum(['approved', 'rejected']), rejectionReason: z.string().trim().min(1).max(1000).optional() }).refine((value) => value.status !== 'rejected' || !!value.rejectionReason, { message: 'A reason is required when rejecting a document.' }).parse(req.body);
    const document = await prisma.sellerDocument.findFirst({ where: { id: String(req.params.documentId), sellerId: String(req.params.sellerId) }, select: { id: true, sellerId: true, kind: true, status: true } });
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
hostRouter.get('/transactions', async (req, res, next) => {
  try {
    const page = z.coerce.number().int().min(1).default(1).parse(req.query.page);
    const limit = z.coerce.number().int().min(1).max(100).default(50).parse(req.query.limit);
    const status = z.nativeEnum(OrderStatus).optional().parse(req.query.status);
    const where: Prisma.OrderWhereInput = status ? { status } : {};
    const [orders, total, activeValue, completedValue, cancelledValue] = await Promise.all([
      prisma.order.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' }, select: { id: true, sellerId: true, status: true, totalAmount: true, createdAt: true, request: { select: { clientId: true, client: { select: { email: true, clientProfile: { select: { name: true } } } } } }, offer: { select: { seller: { select: { email: true, profile: { select: { shopName: true } } } } } } } }),
      prisma.order.count({ where }),
      prisma.order.aggregate({ where: { status: { not: OrderStatus.CANCELLED } }, _sum: { totalAmount: true } }),
      prisma.order.aggregate({ where: { status: OrderStatus.COMPLETED }, _sum: { totalAmount: true } }),
      prisma.order.aggregate({ where: { status: OrderStatus.CANCELLED }, _sum: { totalAmount: true } }),
    ]);
    res.json({ data: {
      items: orders.map((order) => ({ id: order.id, orderId: order.id, clientId: order.request.clientId, clientName: order.request.client?.clientProfile?.name ?? order.request.client?.email ?? 'Unknown buyer', sellerId: order.sellerId, sellerName: order.offer.seller.profile?.shopName ?? order.offer.seller.email, amountTnd: order.totalAmount.toString(), status: order.status, createdAt: order.createdAt })),
      pagination: { page, limit, total },
      totals: { grossOrderValueTnd: activeValue._sum.totalAmount?.toString() ?? '0', completedOrderValueTnd: completedValue._sum.totalAmount?.toString() ?? '0', cancelledOrderValueTnd: cancelledValue._sum.totalAmount?.toString() ?? '0', orderCount: total },
    } });
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
      const category = await tx.marketplaceCategory.update({ where: { id: String(req.params.id) }, data: input });
      await tx.hostAuditLog.create({ data: { actorId: hostId(req), action: 'CATEGORY_UPDATED', entityType: 'category', entityId: category.id, details: input } });
      return category;
    });
    res.json({ data });
  } catch (error) { next(error); }
});
hostRouter.delete('/categories/:id', async (req, res, next) => {
  try {
    const category = await prisma.marketplaceCategory.findUnique({ where: { id: String(req.params.id) }, select: { id: true, name: true } });
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
    const key = z.string().regex(/^[a-z][a-z0-9_.-]{1,80}$/).parse(String(req.params.key));
    const { value } = z.object({ value: z.union([z.string().max(2000), z.number().finite(), z.boolean(), z.array(z.string().max(200)), z.record(z.string(), z.unknown())]) }).parse(req.body);
    const data = await prisma.$transaction(async (tx) => {
      const setting = await tx.platformSetting.upsert({ where: { key }, create: { key, value: value as Prisma.InputJsonValue }, update: { value: value as Prisma.InputJsonValue } });
      await tx.hostAuditLog.create({ data: { actorId: hostId(req), action: 'SETTING_UPDATED', entityType: 'setting', entityId: key, details: { value } as Prisma.InputJsonValue } });
      return setting;
    });
    if (key === 'restrictDirectContact') {
      invalidateContactPolicyCache();
    }
    res.json({ data });
  } catch (error) { next(error); }
});
