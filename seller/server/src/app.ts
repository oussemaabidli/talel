import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';
import { z, ZodError } from 'zod';
import { randomBytes, createHash } from 'node:crypto';
import { rm } from 'node:fs/promises';
import bcrypt from 'bcryptjs';
import { Prisma, PartCondition, OfferStatus, OrderStatus, RequestStatus, type InventoryPart } from '@prisma/client';
import { prisma } from './db.js';
import { env, allowedOrigins } from './config/env.js';
import { requireSeller, requireApprovedSeller } from './middleware/auth.js';
import { hostRouter } from './routes/host.js';
import { clientRouter } from './routes/client.js';
import { deletePrivateDocument, documentKinds, identifyDocument, maxDocumentBytes, safeOriginalName, savePrivateDocument } from './documents/storage.js';

export const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin(origin, callback) { if (!origin || allowedOrigins.includes(origin)) callback(null, true); else callback(new Error('Origin not allowed')); }, credentials: true, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] }));
app.use(express.json({ limit: '256kb' }));
app.use(cookieParser(env.COOKIE_SECRET));
app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.get('/health/ready', async (_req, res) => {
  try { await prisma.$queryRaw`SELECT 1`; res.json({ status: 'ready', database: 'connected' }); }
  catch { res.status(503).json({ status: 'not_ready', database: 'unavailable' }); }
});
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: { code: 'RATE_LIMITED', message: 'Too many attempts. Try again later.' } } });
const uploadLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 12, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: { code: 'UPLOAD_RATE_LIMITED', message: 'Too many document uploads. Try again later.' } } });
const api = express.Router();
app.use('/api/v1', api);

const emailSchema = z.string().trim().email().max(254).transform((v) => v.toLowerCase());
const phoneSchema = z.string().trim().regex(/^(?:\+216\s*)?[2-9](?:\s?\d){7}$/).transform((value) => value.replace(/\s/g, '')).optional();
const registerSchema = z.object({ email: emailSchema, phone: phoneSchema, password: z.string().min(10).max(128), name: z.string().trim().min(1).max(100), shopName: z.string().trim().min(1).max(120), legalName: z.string().trim().max(160).optional(), commercialName: z.string().trim().max(160).optional(), legalForm: z.string().max(80).optional(), rneNumber: z.string().max(80).optional(), taxIdentifier: z.string().max(80).optional(), address: z.string().max(300).optional(), city: z.string().max(100).optional(), governorate: z.string().max(100).optional(), postalCode: z.string().max(20).optional(), businessPhone: phoneSchema, businessEmail: emailSchema.optional(), website: z.string().url().max(255).optional(), categories: z.array(z.string().max(80)).max(30).optional(), productsSold: z.string().max(40).optional(), salesType: z.string().max(40).optional(), locationType: z.string().max(80).optional(), experienceYears: z.number().int().nonnegative().max(100).optional(), supportedMakes: z.array(z.string().max(80)).max(100).optional(), description: z.string().max(4000).optional() });
const loginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(128) });
const sessionCookie = { httpOnly: true, signed: true, sameSite: 'strict' as const, secure: env.NODE_ENV === 'production', path: '/', maxAge: env.SESSION_TTL_DAYS * 86400000 };
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

api.get('/openapi.json', (_req, res) => res.json({
  openapi: '3.1.0', info: { title: 'Talel Shared API', version: '1.1.0' }, servers: [{ url: '/api/v1' }],
  paths: Object.fromEntries([
    ['/auth/register', ['post']], ['/auth/login', ['post']], ['/auth/logout', ['post']], ['/auth/me', ['get']],
    ['/client/auth/register', ['post']], ['/client/auth/login', ['post']], ['/client/auth/logout', ['post']], ['/client/auth/me', ['get']],
    ['/client/profile', ['patch']], ['/client/requests', ['get', 'post']], ['/client/requests/{requestId}', ['get', 'patch']], ['/client/requests/{requestId}/cancel', ['post']],
    ['/client/offers', ['get']], ['/client/offers/{offerId}/accept', ['post']], ['/client/offers/{offerId}/reject', ['post']], ['/client/offers/{offerId}/conversation', ['post']],
    ['/client/orders', ['get']], ['/client/orders/{orderId}', ['get']], ['/client/orders/{orderId}/cancel', ['post']], ['/client/conversations', ['get']], ['/client/conversations/{conversationId}/messages', ['get', 'post']],
    ['/client/notifications', ['get']], ['/client/notifications/read-all', ['patch']], ['/client/notifications/{notificationId}/read', ['patch']],
    ['/seller/dashboard', ['get']], ['/seller/profile', ['get', 'patch']], ['/seller/inventory', ['get', 'post']],
    ['/seller/inventory/{id}', ['get', 'patch', 'delete']], ['/seller/inventory/{id}/stock', ['post']],
    ['/seller/requests', ['get']], ['/seller/requests/{id}', ['get']], ['/seller/offers', ['get', 'post']],
    ['/seller/offers/{id}', ['get', 'patch']], ['/seller/orders', ['get']], ['/seller/orders/{id}', ['get']],
    ['/seller/orders/{id}/events', ['post']], ['/seller/sales', ['get']], ['/seller/conversations', ['get']],
    ['/seller/conversations/{id}/messages', ['get', 'post']], ['/seller/notifications', ['get']],
    ['/seller/notifications/read-all', ['patch']], ['/seller/notifications/{id}/read', ['patch']],
    ['/host/auth/login', ['post']], ['/host/auth/me', ['get']], ['/host/dashboard', ['get']],
    ['/host/users', ['get']], ['/host/users/{id}/status', ['patch']], ['/host/sellers', ['get']],
    ['/seller/documents', ['get']], ['/seller/documents/{kind}', ['put', 'delete']],
    ['/host/sellers/{id}/verification', ['patch']], ['/host/sellers/{id}/documents', ['get']],
    ['/host/sellers/{sellerId}/documents/{documentId}/file', ['get']], ['/host/sellers/{sellerId}/documents/{documentId}/review', ['patch']],
    ['/host/requests', ['get']], ['/host/offers', ['get']],
    ['/host/orders', ['get']], ['/host/transactions', ['get']], ['/host/activity', ['get']],
    ['/host/categories', ['get', 'post']], ['/host/categories/{id}', ['patch', 'delete']],
    ['/host/settings', ['get']], ['/host/settings/{key}', ['patch']],
  ].map(([path, methods]) => [path, Object.fromEntries((methods as string[]).map((method) => {
    const routePath = String(path);
    const isPublic = routePath === '/auth/register' || routePath === '/auth/login' || routePath === '/host/auth/login' || routePath === '/client/auth/register' || routePath === '/client/auth/login';
    const security = isPublic ? [] : routePath.startsWith('/host/') ? [{ hostSession: [] }] : routePath.startsWith('/client/') ? [{ clientSession: [] }] : [{ sellerSession: [] }];
    return [method, { security, responses: { '200': { description: 'Successful response' }, '400': { description: 'Validation error' }, '401': { description: 'Authentication required' }, '403': { description: 'Forbidden or seller verification required' } } }];
  }))])),
  components: { securitySchemes: { sellerSession: { type: 'apiKey', in: 'cookie', name: 'talel_session' }, clientSession: { type: 'apiKey', in: 'cookie', name: 'talel_session' }, hostSession: { type: 'apiKey', in: 'cookie', name: 'talel_session' } } },
}));

api.post('/auth/register', authLimiter, async (req, res, next) => {
  try {
    const input = registerSchema.parse(req.body);
    const passwordHash = await bcrypt.hash(input.password, 12);
    const { name, shopName, ...business } = input;
    const user = await prisma.user.create({ data: { email: input.email, phone: input.phone, passwordHash, role: 'SELLER', profile: { create: { name, shopName, legalName: business.legalName, commercialName: business.commercialName, legalForm: business.legalForm, rneNumber: business.rneNumber, taxIdentifier: business.taxIdentifier, address: business.address, city: business.city, governorate: business.governorate, postalCode: business.postalCode, businessPhone: business.businessPhone, businessEmail: business.businessEmail, website: business.website, categories: business.categories ?? [], productsSold: business.productsSold, salesType: business.salesType, locationType: business.locationType, experienceYears: business.experienceYears, supportedMakes: business.supportedMakes ?? [], description: business.description ?? '' } } }, select: { id: true, email: true } });
    const rawToken = randomBytes(32).toString('base64url');
    await prisma.session.create({ data: { userId: user.id, tokenHash: sha256(rawToken), expiresAt: new Date(Date.now() + sessionCookie.maxAge) } });
    res.cookie('talel_session', rawToken, sessionCookie).status(201).json({ data: { user, verificationStatus: 'pending_verification' } });
  } catch (error) { next(error); }
});
api.post('/auth/login', authLimiter, async (req, res, next) => {
  try {
    const input = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true, email: true, passwordHash: true, role: true, isActive: true, profile: { select: { verificationStatus: true } } } });
    if (!user || user.role !== 'SELLER' || !user.isActive || !(await bcrypt.compare(input.password, user.passwordHash))) return res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect.' } });
    const rawToken = randomBytes(32).toString('base64url');
    await prisma.session.create({ data: { userId: user.id, tokenHash: sha256(rawToken), expiresAt: new Date(Date.now() + sessionCookie.maxAge) } });
    res.cookie('talel_session', rawToken, sessionCookie).json({ data: { user: { id: user.id, email: user.email }, verificationStatus: user.profile?.verificationStatus ?? 'pending_verification' } });
  } catch (error) { next(error); }
});
api.post('/auth/logout', async (req, res, next) => {
  try { const token = req.signedCookies?.talel_session as string | undefined; if (token) await prisma.session.deleteMany({ where: { tokenHash: sha256(token) } }); res.clearCookie('talel_session', { httpOnly: true, sameSite: 'strict', secure: env.NODE_ENV === 'production', path: '/' }).status(204).end(); } catch (error) { next(error); }
});
api.get('/auth/me', requireSeller, async (req, res, next) => {
  try { const user = await prisma.user.findUnique({ where: { id: req.sellerId }, select: { id: true, email: true, profile: true } }); res.json({ data: user }); } catch (error) { next(error); }
});

api.use('/host', hostRouter);
api.use('/client', clientRouter);
api.use(requireSeller);
const sellerId = (req: express.Request) => req.sellerId!;
const privateDocumentFields = { id: true, kind: true, originalName: true, mimeType: true, size: true, status: true, rejectionReason: true, submittedAt: true, reviewedAt: true } as const;
api.get('/seller/documents', async (req, res, next) => {
  try { res.set('Cache-Control', 'private, no-store').json({ data: await prisma.sellerDocument.findMany({ where: { sellerId: sellerId(req) }, select: privateDocumentFields, orderBy: { submittedAt: 'desc' } }) }); }
  catch (error) { next(error); }
});
api.put('/seller/documents/:kind', uploadLimiter, express.raw({ type: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'application/octet-stream'], limit: maxDocumentBytes }), async (req, res, next) => {
  let savedPath: string | undefined;
  try {
    const kind = z.enum(documentKinds).parse(req.params.kind);
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) return res.status(400).json({ error: { code: 'EMPTY_DOCUMENT', message: 'Choose a non-empty PDF or image file.' } });
    if (req.body.length > maxDocumentBytes) return res.status(413).json({ error: { code: 'DOCUMENT_TOO_LARGE', message: 'Each document must be 10 MB or smaller.' } });
    const detected = identifyDocument(req.body);
    const claimedType = (req.headers['content-type'] ?? '').split(';')[0]?.trim().toLowerCase();
    if (!detected || (claimedType !== 'application/octet-stream' && detected.mimeType !== claimedType)) return res.status(415).json({ error: { code: 'INVALID_DOCUMENT_TYPE', message: 'The document content must match a supported PDF or image type.' } });
    const currentProfile = await prisma.sellerProfile.findUnique({ where: { userId: sellerId(req) }, select: { verificationStatus: true } });
    if (!currentProfile || currentProfile.verificationStatus === 'verified') return res.status(409).json({ error: { code: 'DOCUMENTS_LOCKED', message: 'Documents cannot be changed after seller verification.' } });
    const verificationStatus = currentProfile.verificationStatus;
    const existing = await prisma.sellerDocument.findUnique({ where: { sellerId_kind: { sellerId: sellerId(req), kind } }, select: { storageName: true } });
    const stored = await savePrivateDocument(sellerId(req), req.body, detected.extension);
    savedPath = stored.filePath;
    const rawName = req.headers['x-file-name'];
    let decodedName = 'document';
    try { if (typeof rawName === 'string') decodedName = decodeURIComponent(rawName); }
    catch { await rm(stored.filePath, { force: true }); return res.status(400).json({ error: { code: 'INVALID_FILE_NAME', message: 'The file name is invalid.' } }); }
    const originalName = safeOriginalName(decodedName);
    const document = await prisma.$transaction(async (tx) => {
      const saved = await tx.sellerDocument.upsert({
        where: { sellerId_kind: { sellerId: sellerId(req), kind } },
        create: { sellerId: sellerId(req), kind, originalName, storageName: stored.storageName, mimeType: detected.mimeType, size: req.body.length, sha256: stored.sha256 },
        update: { originalName, storageName: stored.storageName, mimeType: detected.mimeType, size: req.body.length, sha256: stored.sha256, status: 'pending', rejectionReason: null, submittedAt: new Date(), reviewedAt: null, reviewerId: null },
        select: privateDocumentFields,
      });
      if (verificationStatus === 'rejected') await tx.sellerProfile.update({ where: { userId: sellerId(req) }, data: { verificationStatus: 'pending_verification', verificationRejectionReason: null } });
      return saved;
    });
    savedPath = undefined;
    if (existing) await deletePrivateDocument(sellerId(req), existing.storageName).catch(() => undefined);
    res.status(existing ? 200 : 201).set('Cache-Control', 'private, no-store').json({ data: document });
  } catch (error) {
    if (savedPath) await rm(savedPath, { force: true }).catch(() => undefined);
    next(error);
  }
});
api.delete('/seller/documents/:kind', async (req, res, next) => {
  try {
    const kind = z.enum(documentKinds).parse(req.params.kind);
    const document = await prisma.sellerDocument.findUnique({ where: { sellerId_kind: { sellerId: sellerId(req), kind } }, select: { id: true, storageName: true, status: true } });
    if (!document) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Document not found.' } });
    if (document.status === 'approved') return res.status(409).json({ error: { code: 'DOCUMENT_ALREADY_REVIEWED', message: 'An approved document cannot be removed.' } });
    await prisma.sellerDocument.delete({ where: { id: document.id } });
    await deletePrivateDocument(sellerId(req), document.storageName);
    res.status(204).end();
  } catch (error) { next(error); }
});
for (const path of ['/seller/dashboard', '/seller/inventory', '/seller/requests', '/seller/offers', '/seller/orders', '/seller/sales', '/seller/conversations']) api.use(path, requireApprovedSeller);
const partSchema = z.object({ partName: z.string().trim().min(1).max(160), sku: z.string().trim().min(1).max(80), oemReference: z.string().trim().max(100).optional(), brand: z.string().trim().min(1).max(100), category: z.string().trim().min(1).max(80), description: z.string().max(4000).optional(), compatibleVehicles: z.array(z.string().max(120)).max(100).optional(), condition: z.nativeEnum(PartCondition).default(PartCondition.NEW), price: z.number().finite().nonnegative().max(999999999), stock: z.number().int().nonnegative().max(1000000), minimumStock: z.number().int().nonnegative().max(1000000).default(0), warranty: z.string().max(120).optional(), isActive: z.boolean().optional() });
api.get('/seller/inventory', async (req, res, next) => {
  try {
    const page = z.coerce.number().int().min(1).default(1).parse(req.query.page);
    const limit = z.coerce.number().int().min(1).max(100).default(25).parse(req.query.limit);
    const search = z.string().trim().max(100).optional().parse(req.query.search);
    const category = z.string().max(80).optional().parse(req.query.category);
    const where: Prisma.InventoryPartWhereInput = { sellerId: sellerId(req), ...(category ? { category } : {}), ...(search ? { OR: [{ partName: { contains: search, mode: 'insensitive' } }, { sku: { contains: search, mode: 'insensitive' } }, { oemReference: { contains: search, mode: 'insensitive' } }, { brand: { contains: search, mode: 'insensitive' } }] } : {}) };
    const [data, total] = await Promise.all([prisma.inventoryPart.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { updatedAt: 'desc' } }), prisma.inventoryPart.count({ where })]);
    res.json({ data, pagination: { page, limit, total } });
  } catch (error) { next(error); }
});
api.post('/seller/inventory', async (req, res, next) => { try { const data = partSchema.parse(req.body); res.status(201).json({ data: await prisma.inventoryPart.create({ data: { ...data, sellerId: sellerId(req), price: new Prisma.Decimal(data.price), description: data.description ?? '', compatibleVehicles: data.compatibleVehicles ?? [], warranty: data.warranty ?? '' } }) }); } catch (error) { next(error); } });
api.get('/seller/inventory/:id', async (req, res, next) => { try { const data = await prisma.inventoryPart.findFirst({ where: { id: req.params.id, sellerId: sellerId(req) } }); if (!data) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Inventory item not found.' } }); res.json({ data }); } catch (error) { next(error); } });
api.patch('/seller/inventory/:id', async (req, res, next) => { try { const data = partSchema.partial().parse(req.body); const result = await prisma.inventoryPart.updateMany({ where: { id: req.params.id, sellerId: sellerId(req) }, data: { ...data, ...(data.price !== undefined ? { price: new Prisma.Decimal(data.price) } : {}) } }); if (!result.count) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Inventory item not found.' } }); res.json({ data: await prisma.inventoryPart.findFirst({ where: { id: req.params.id, sellerId: sellerId(req) } }) }); } catch (error) { next(error); } });
api.post('/seller/inventory/:id/stock', async (req, res, next) => { try { const { delta } = z.object({ delta: z.number().int().min(-1000000).max(1000000).refine((n) => n !== 0) }).parse(req.body); const result = await prisma.inventoryPart.updateMany({ where: { id: req.params.id, sellerId: sellerId(req), stock: { gte: Math.max(0, -delta) } }, data: { stock: { increment: delta } } }); if (!result.count) return res.status(409).json({ error: { code: 'STOCK_CONFLICT', message: 'Item not found or stock cannot become negative.' } }); res.json({ data: await prisma.inventoryPart.findFirst({ where: { id: req.params.id, sellerId: sellerId(req) } }) }); } catch (error) { next(error); } });
api.delete('/seller/inventory/:id', async (req, res, next) => { try { const result = await prisma.inventoryPart.updateMany({ where: { id: req.params.id, sellerId: sellerId(req) }, data: { isActive: false } }); if (!result.count) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Inventory item not found.' } }); res.status(204).end(); } catch (error) { next(error); } });

const requestPublicFields = { id: true, partName: true, category: true, oemReference: true, brand: true, vehicleMake: true, vehicleModel: true, vehicleYear: true, condition: true, quantity: true, minBudget: true, maxBudget: true, location: true, deliveryMethod: true, description: true, status: true, createdAt: true, updatedAt: true, _count: { select: { offers: true } } } as const;
api.get('/seller/requests', async (req, res, next) => { try { const search = z.string().trim().max(100).optional().parse(req.query.search); const data = await prisma.marketplaceRequest.findMany({ where: { status: { in: [RequestStatus.PUBLISHED, RequestStatus.OFFERS_RECEIVED] }, ...(search ? { OR: [{ partName: { contains: search, mode: 'insensitive' } }, { oemReference: { contains: search, mode: 'insensitive' } }, { category: { contains: search, mode: 'insensitive' } }] } : {}) }, select: requestPublicFields, orderBy: { createdAt: 'desc' }, take: 100 }); res.json({ data }); } catch (error) { next(error); } });
api.get('/seller/requests/:id', async (req, res, next) => { try { const data = await prisma.marketplaceRequest.findUnique({ where: { id: req.params.id }, select: requestPublicFields }); if (!data) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Request not found.' } }); res.json({ data }); } catch (error) { next(error); } });

const offerSchema = z.object({ requestId: z.string().min(1), partName: z.string().trim().min(1).max(160), brand: z.string().max(100).default(''), referenceNumber: z.string().max(100).default(''), condition: z.nativeEnum(PartCondition), price: z.number().finite().positive().max(999999999), quantity: z.number().int().positive().max(100000), warranty: z.string().max(120).default(''), deliveryFee: z.number().finite().nonnegative().max(999999999).default(0), estimatedDelivery: z.string().max(120).default(''), description: z.string().max(4000).default('') });
api.get('/seller/offers', async (req, res, next) => { try { const status = z.nativeEnum(OfferStatus).optional().parse(req.query.status); const requestId = z.string().max(80).optional().parse(req.query.requestId); res.json({ data: await prisma.offer.findMany({ where: { sellerId: sellerId(req), ...(status ? { status } : {}), ...(requestId ? { requestId } : {}) }, include: { request: { select: requestPublicFields } }, orderBy: { createdAt: 'desc' } }) }); } catch (error) { next(error); } });
api.post('/seller/offers', async (req, res, next) => { try { const input = offerSchema.parse(req.body); const request = await prisma.marketplaceRequest.findFirst({ where: { id: input.requestId, status: { in: [RequestStatus.PUBLISHED, RequestStatus.OFFERS_RECEIVED] } } }); if (!request) return res.status(409).json({ error: { code: 'REQUEST_CLOSED', message: 'This request is not accepting offers.' } }); const offer = await prisma.$transaction(async (tx) => { if (await tx.offer.findFirst({ where: { sellerId: sellerId(req), requestId: input.requestId, status: OfferStatus.PENDING }, select: { id: true } })) throw new Error('DUPLICATE_ACTIVE_OFFER'); const created = await tx.offer.create({ data: { ...input, sellerId: sellerId(req), price: new Prisma.Decimal(input.price), deliveryFee: new Prisma.Decimal(input.deliveryFee), status: OfferStatus.PENDING } }); await tx.marketplaceRequest.updateMany({ where: { id: request.id, status: RequestStatus.PUBLISHED }, data: { status: RequestStatus.OFFERS_RECEIVED } }); if (request.clientId) await tx.notification.create({ data: { userId: request.clientId, type: 'offer_received', title: 'New seller offer', message: `A seller submitted an offer for ${request.partName}.`, link: `/client/offers/${created.id}` } }); return created; }); res.status(201).json({ data: offer }); } catch (error) { next(error); } });
api.get('/seller/offers/:id', async (req, res, next) => { try { const data = await prisma.offer.findFirst({ where: { id: req.params.id, sellerId: sellerId(req) }, include: { request: { select: requestPublicFields } } }); if (!data) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Offer not found.' } }); res.json({ data }); } catch (error) { next(error); } });
api.patch('/seller/offers/:id', async (req, res, next) => { try { const { status } = z.object({ status: z.literal(OfferStatus.WITHDRAWN) }).parse(req.body); const result = await prisma.offer.updateMany({ where: { id: req.params.id, sellerId: sellerId(req), status: OfferStatus.PENDING }, data: { status } }); if (!result.count) return res.status(409).json({ error: { code: 'INVALID_TRANSITION', message: 'This offer cannot be withdrawn.' } }); res.json({ data: await prisma.offer.findFirst({ where: { id: req.params.id, sellerId: sellerId(req) } }) }); } catch (error) { next(error); } });

const sellerOrderTransitions: Partial<Record<OrderStatus, OrderStatus[]>> = { [OrderStatus.OFFER_ACCEPTED]: [OrderStatus.SELLER_CONFIRMED], [OrderStatus.SELLER_CONFIRMED]: [OrderStatus.PREPARING], [OrderStatus.PREPARING]: [OrderStatus.READY], [OrderStatus.READY]: [OrderStatus.DISPATCHED], [OrderStatus.DISPATCHED]: [OrderStatus.COMPLETED] };
api.get('/seller/orders', async (req, res, next) => { try { res.json({ data: await prisma.order.findMany({ where: { sellerId: sellerId(req) }, include: { offer: true, request: true, events: { orderBy: { createdAt: 'asc' } } }, orderBy: { createdAt: 'desc' } }) }); } catch (error) { next(error); } });
api.get('/seller/orders/:id', async (req, res, next) => { try { const data = await prisma.order.findFirst({ where: { id: req.params.id, sellerId: sellerId(req) }, include: { offer: true, request: true, events: { orderBy: { createdAt: 'asc' } } } }); if (!data) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Order not found.' } }); res.json({ data }); } catch (error) { next(error); } });
api.post('/seller/orders/:id/events', async (req, res, next) => { try { const { status } = z.object({ status: z.nativeEnum(OrderStatus) }).parse(req.body); const result = await prisma.$transaction(async (tx) => { const order = await tx.order.findFirst({ where: { id: req.params.id, sellerId: sellerId(req) } }); if (!order) return null; if (!sellerOrderTransitions[order.status]?.includes(status)) throw new Error('INVALID_ORDER_TRANSITION'); const updated = await tx.order.update({ where: { id: order.id }, data: { status } }); await tx.orderEvent.create({ data: { orderId: order.id, status } }); if (status === OrderStatus.COMPLETED) await tx.notification.create({ data: { userId: order.sellerId, type: 'order_completed', title: 'Order completed', message: `Order ${order.id} was completed.` } }); return updated; }); if (!result) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Order not found.' } }); res.json({ data: result }); } catch (error) { next(error); } });

api.get('/seller/dashboard', async (req, res, next) => { try { const id = sellerId(req); const [activeRequests, pendingOffers, inProgressOrders, completedOrders, completed, lowStock, recentRequests, recentOrders, profile] = await Promise.all([prisma.marketplaceRequest.count({ where: { status: { in: [RequestStatus.PUBLISHED, RequestStatus.OFFERS_RECEIVED] } } }), prisma.offer.count({ where: { sellerId: id, status: OfferStatus.PENDING } }), prisma.order.count({ where: { sellerId: id, status: { in: [OrderStatus.OFFER_ACCEPTED, OrderStatus.SELLER_CONFIRMED, OrderStatus.PREPARING, OrderStatus.READY, OrderStatus.DISPATCHED] } } }), prisma.order.count({ where: { sellerId: id, status: OrderStatus.COMPLETED } }), prisma.order.aggregate({ where: { sellerId: id, status: OrderStatus.COMPLETED }, _sum: { totalAmount: true } }), prisma.$queryRaw<Array<InventoryPart>>`SELECT * FROM "InventoryPart" WHERE "sellerId" = ${id} AND "isActive" = true AND "stock" <= "minimumStock" ORDER BY "stock" ASC LIMIT 10`, prisma.marketplaceRequest.findMany({ where: { status: { in: [RequestStatus.PUBLISHED, RequestStatus.OFFERS_RECEIVED] } }, select: requestPublicFields, orderBy: { createdAt: 'desc' }, take: 5 }), prisma.order.findMany({ where: { sellerId: id, status: { not: OrderStatus.CANCELLED } }, select: { id: true, status: true, totalAmount: true, createdAt: true, offer: { select: { partName: true } } }, orderBy: { createdAt: 'desc' }, take: 5 }), prisma.sellerProfile.findUnique({ where: { userId: id }, select: { shopName: true } })]); res.json({ data: { activeRequests, pendingOffers, inProgressOrders, completedOrders, completedRevenueTnd: completed._sum.totalAmount?.toString() ?? '0', averageResponseTimeHours: null, lowStock, recentRequests, recentOrders, profile } }); } catch (error) { next(error); } });
api.get('/seller/sales', async (req, res, next) => { try { const from = z.coerce.date().optional().parse(req.query.from); const to = z.coerce.date().optional().parse(req.query.to); const where = { sellerId: sellerId(req), status: OrderStatus.COMPLETED, ...(from || to ? { updatedAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}) }; const [count, aggregate, rows] = await Promise.all([prisma.order.count({ where }), prisma.order.aggregate({ where, _sum: { totalAmount: true }, _avg: { totalAmount: true } }), prisma.order.findMany({ where, select: { id: true, totalAmount: true, updatedAt: true, offer: { select: { partName: true } } }, orderBy: { updatedAt: 'desc' }, take: 500 })]); res.json({ data: { completedSales: count, revenueTnd: aggregate._sum.totalAmount?.toString() ?? '0', averageOrderValueTnd: aggregate._avg.totalAmount?.toString() ?? '0', history: rows } }); } catch (error) { next(error); } });

api.get('/seller/profile', async (req, res, next) => { try { res.json({ data: await prisma.sellerProfile.findUnique({ where: { userId: sellerId(req) }, include: { user: { select: { email: true, phone: true } } } }) }); } catch (error) { next(error); } });
api.patch('/seller/profile', async (req, res, next) => { try { const data = z.object({ name: z.string().trim().min(1).max(100).optional(), shopName: z.string().trim().min(1).max(120).optional(), legalName: z.string().max(160).nullable().optional(), commercialName: z.string().max(160).nullable().optional(), taxIdentifier: z.string().max(80).nullable().optional(), address: z.string().max(300).nullable().optional(), city: z.string().max(100).nullable().optional(), governorate: z.string().max(100).nullable().optional(), businessHours: z.string().max(300).nullable().optional(), businessPhone: phoneSchema, businessEmail: emailSchema.optional(), supportedMakes: z.array(z.string().max(80)).max(100).optional(), specialties: z.array(z.string().max(80)).max(100).optional(), paymentTerms: z.array(z.string().max(80)).max(30).optional(), description: z.string().max(4000).optional() }).parse(req.body); res.json({ data: await prisma.sellerProfile.update({ where: { userId: sellerId(req) }, data }) }); } catch (error) { next(error); } });

api.get('/seller/notifications', async (req, res, next) => { try { const unreadOnly = z.enum(['true', 'false']).default('false').parse(req.query.unread); res.json({ data: await prisma.notification.findMany({ where: { userId: sellerId(req), ...(unreadOnly === 'true' ? { readAt: null } : {}) }, orderBy: { createdAt: 'desc' }, take: 100 }) }); } catch (error) { next(error); } });
api.patch('/seller/notifications/read-all', async (req, res, next) => { try { const result = await prisma.notification.updateMany({ where: { userId: sellerId(req), readAt: null }, data: { readAt: new Date() } }); res.json({ data: { updated: result.count } }); } catch (error) { next(error); } });
api.patch('/seller/notifications/:id/read', async (req, res, next) => { try { const result = await prisma.notification.updateMany({ where: { id: req.params.id, userId: sellerId(req), readAt: null }, data: { readAt: new Date() } }); if (!result.count) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Notification not found.' } }); res.status(204).end(); } catch (error) { next(error); } });

api.get('/seller/conversations', async (req, res, next) => { try { res.json({ data: await prisma.conversation.findMany({ where: { participants: { some: { userId: sellerId(req) } } }, include: { messages: { orderBy: { createdAt: 'asc' }, take: 100 }, participants: { select: { userId: true } } }, orderBy: { createdAt: 'desc' } }) }); } catch (error) { next(error); } });
api.get('/seller/conversations/:id/messages', async (req, res, next) => { try { const allowed = await prisma.conversationParticipant.findUnique({ where: { conversationId_userId: { conversationId: req.params.id, userId: sellerId(req) } } }); if (!allowed) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Conversation not found.' } }); res.json({ data: await prisma.message.findMany({ where: { conversationId: req.params.id }, orderBy: { createdAt: 'asc' }, take: 500 }) }); } catch (error) { next(error); } });
api.post('/seller/conversations/:id/messages', async (req, res, next) => { try { const { body } = z.object({ body: z.string().trim().min(1).max(4000) }).parse(req.body); const allowed = await prisma.conversationParticipant.findUnique({ where: { conversationId_userId: { conversationId: req.params.id, userId: sellerId(req) } } }); if (!allowed) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Conversation not found.' } }); res.status(201).json({ data: await prisma.message.create({ data: { conversationId: req.params.id, senderId: sellerId(req), body } }) }); } catch (error) { next(error); } });

app.use((_req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Endpoint not found.' } }));
app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof ZodError) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Request validation failed.', details: error.issues.map((issue) => ({ path: issue.path, message: issue.message })) } });
  if (error instanceof Error && (error as Error & { type?: string }).type === 'entity.too.large') return res.status(413).json({ error: { code: 'DOCUMENT_TOO_LARGE', message: 'Each document must be 10 MB or smaller.' } });
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return res.status(409).json({ error: { code: 'CONFLICT', message: 'A record with those details already exists.' } });
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Record not found.' } });
  if (error instanceof Error && error.message === 'INVALID_ORDER_TRANSITION') return res.status(409).json({ error: { code: 'INVALID_TRANSITION', message: 'This order status transition is not allowed.' } });
  if (error instanceof Error && error.message === 'DUPLICATE_ACTIVE_OFFER') return res.status(409).json({ error: { code: 'DUPLICATE_OFFER', message: 'You already have an active offer for this request.' } });
  if (error instanceof Error && (error as Error & { code?: string }).code === 'OFFER_NOT_ACTIONABLE') return res.status(409).json({ error: { code: 'OFFER_NOT_ACTIONABLE', message: error.message } });
  if (error instanceof Error && (error as Error & { code?: string }).code === 'ORDER_NOT_CANCELLABLE') return res.status(409).json({ error: { code: 'ORDER_NOT_CANCELLABLE', message: error.message } });
  if (env.NODE_ENV !== 'production') console.error(error);
  return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' } });
});
