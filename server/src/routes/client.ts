import { Router, raw } from 'express';
import { z } from 'zod';
import { randomBytes, createHash } from 'node:crypto';
import { rm } from 'node:fs/promises';
import bcrypt from 'bcryptjs';
import { rateLimit } from 'express-rate-limit';
import { Prisma, PartCondition, RequestStatus } from '@prisma/client';
import { prisma } from '../db.js';
import { env } from '../config/env.js';
import { requireClient } from '../middleware/auth.js';
import { contactPolicyError, messageContactPolicyViolation } from '../messaging/contactPolicy.js';
import { deletePrivateRequestImage, identifyRequestImage, maxRequestImageBytes, readPrivateRequestImage, safeOriginalName, savePrivateRequestImage } from '../documents/storage.js';
import { TUNISIAN_GOVERNORATES } from '../marketplace/locations.js';

export const clientRouter = Router();
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: { code: 'RATE_LIMITED', message: 'Too many attempts. Try again later.' } } });
const communicationLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: { code: 'RATE_LIMITED', message: 'Too many marketplace submissions. Try again later.' } } });
const requestImageLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: { code: 'UPLOAD_RATE_LIMITED', message: 'Too many photo uploads. Try again later.' } } });
const email = z.string().trim().email().max(254).transform(v => v.toLowerCase());
const clientSignup = z.object({ email, password: z.string().min(10).max(128), name: z.string().trim().min(1).max(100), phone: z.string().trim().max(32).optional(), address: z.string().trim().max(300).optional(), city: z.string().trim().max(100).optional() });
const login = z.object({ email, password: z.string().min(1).max(128) });
const cookie = { httpOnly: true, signed: true, sameSite: 'strict' as const, secure: env.NODE_ENV === 'production', path: '/', maxAge: env.SESSION_TTL_DAYS * 86400000 };
const hash = (v: string) => createHash('sha256').update(v).digest('hex');
const publicUser = { id: true, email: true, role: true, isActive: true, clientProfile: { select: { name: true, phone: true, address: true, city: true, vehicles: true } } } as const;

clientRouter.post('/auth/register', authLimiter, async (req, res, next) => {
  try {
    const input = clientSignup.parse(req.body);
    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await prisma.user.create({ data: { email: input.email, phone: input.phone, passwordHash, role: 'CLIENT', clientProfile: { create: { name: input.name, phone: input.phone, address: input.address, city: input.city } } }, select: { id: true, email: true } });
    const raw = randomBytes(32).toString('base64url');
    await prisma.session.create({ data: { userId: user.id, tokenHash: hash(raw), expiresAt: new Date(Date.now() + cookie.maxAge) } });
    res.cookie('talel_session', raw, cookie).status(201).json({ data: { user: { ...user, role: 'CLIENT' } } });
  } catch (e) { next(e); }
});
clientRouter.post('/auth/login', authLimiter, async (req, res, next) => {
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
// Public reference endpoints accessible before and after authentication
clientRouter.get('/categories', async (_req, res, next) => { try { res.json({ data: await prisma.marketplaceCategory.findMany({ where: { isActive: true }, select: { id: true, name: true, description: true, icon: true }, orderBy: { name: 'asc' } }) }); } catch (e) { next(e); } });
clientRouter.get('/governorates', (_req, res) => res.json({ data: TUNISIAN_GOVERNORATES }));

clientRouter.use(requireClient);
const clientId = (req: import('express').Request) => req.clientId!;
clientRouter.post('/support/conversation', communicationLimiter, async (req, res, next) => {
  try {
    const userId = clientId(req);
    const conversation = await prisma.conversation.upsert({
      where: { supportClientId: userId },
      create: { type: 'SUPPORT', supportClientId: userId, participants: { create: { userId } } },
      update: {},
      select: { id: true, type: true, createdAt: true },
    });
    res.status(200).json({ data: conversation });
  } catch (error) { next(error); }
});
clientRouter.get('/support/conversation', async (req, res, next) => {
  try {
    const conversation = await prisma.conversation.findUnique({ where: { supportClientId: clientId(req) }, select: { id: true, type: true, createdAt: true } });
    res.set('Cache-Control', 'private, no-store').json({ data: conversation });
  } catch (error) { next(error); }
});
clientRouter.get('/support/conversation/messages', async (req, res, next) => {
  try {
    const conversation = await prisma.conversation.findUnique({ where: { supportClientId: clientId(req) }, select: { id: true } });
    if (!conversation) return res.json({ data: [] });
    res.set('Cache-Control', 'private, no-store').json({ data: await prisma.message.findMany({ where: { conversationId: conversation.id }, orderBy: { createdAt: 'asc' }, take: 500, include: { sender: { select: { id: true, role: true, clientProfile: { select: { name: true } } } } } }) });
  } catch (error) { next(error); }
});
clientRouter.post('/support/conversation/messages', communicationLimiter, async (req, res, next) => {
  try {
    const { body } = z.object({ body: z.string().trim().min(1).max(4000) }).parse(req.body);
    const conversation = await prisma.conversation.findUnique({ where: { supportClientId: clientId(req) }, select: { id: true } });
    if (!conversation) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Start a support conversation first.' } });
    const message = await prisma.message.create({ data: { conversationId: conversation.id, senderId: clientId(req), body }, include: { sender: { select: { id: true, role: true, clientProfile: { select: { name: true } } } } } });
    res.status(201).json({ data: message });
  } catch (error) { next(error); }
});
const requestImageFields = { id: true, originalName: true, mimeType: true, size: true, createdAt: true } as const;
clientRouter.post('/request-photos', requestImageLimiter, raw({ type: ['image/*', 'application/octet-stream'], limit: maxRequestImageBytes }), async (req, res, next) => {
  let savedPath: string | undefined;
  try {
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) return res.status(400).json({ error: { code: 'EMPTY_IMAGE', message: 'Choose a non-empty photo.' } });
    if (req.body.length > maxRequestImageBytes) return res.status(413).json({ error: { code: 'IMAGE_TOO_LARGE', message: 'Each photo must be 5 MB or smaller.' } });
    const detected = identifyRequestImage(req.body);
    const claimedType = (req.headers['content-type'] ?? '').split(';')[0]?.trim().toLowerCase();
    if (!detected || detected.mimeType !== claimedType) return res.status(415).json({ error: { code: 'INVALID_IMAGE_TYPE', message: 'Upload a valid JPEG, PNG, or WebP image.' } });
    const stagedCount = await prisma.requestImage.count({ where: { clientId: clientId(req), requestId: null } });
    if (stagedCount >= 20) return res.status(429).json({ error: { code: 'TOO_MANY_STAGED_IMAGES', message: 'Remove unused photos before uploading more.' } });
    const rawName = req.headers['x-file-name'];
    let decodedName = 'photo';
    try { if (typeof rawName === 'string') decodedName = decodeURIComponent(rawName); }
    catch { return res.status(400).json({ error: { code: 'INVALID_FILE_NAME', message: 'The photo file name is invalid.' } }); }
    const stored = await savePrivateRequestImage(clientId(req), req.body, detected.extension);
    savedPath = stored.filePath;
    const image = await prisma.requestImage.create({ data: {
      clientId: clientId(req), originalName: safeOriginalName(decodedName), storageName: stored.storageName,
      mimeType: detected.mimeType, size: req.body.length, sha256: stored.sha256,
    }, select: requestImageFields });
    savedPath = undefined;
    res.status(201).set('Cache-Control', 'private, no-store').json({ data: image });
  } catch (error) {
    if (savedPath) await rm(savedPath, { force: true }).catch(() => undefined);
    next(error);
  }
});
clientRouter.delete('/request-photos/:imageId', async (req, res, next) => {
  try {
    const image = await prisma.requestImage.findFirst({ where: { id: String(req.params.imageId), clientId: clientId(req), requestId: null }, select: { id: true, clientId: true, storageName: true } });
    if (!image) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Unattached photo not found.' } });
    await prisma.requestImage.delete({ where: { id: image.id } });
    await deletePrivateRequestImage(image.clientId, image.storageName);
    res.status(204).end();
  } catch (error) { next(error); }
});
clientRouter.get('/requests/:requestId/images/:imageId', async (req, res, next) => {
  try {
    const image = await prisma.requestImage.findFirst({ where: { id: String(req.params.imageId), requestId: String(req.params.requestId), clientId: clientId(req) }, select: { clientId: true, storageName: true, mimeType: true } });
    if (!image) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Photo not found.' } });
    const bytes = await readPrivateRequestImage(image.clientId, image.storageName);
    res.set({ 'Content-Type': image.mimeType, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' }).send(bytes);
  } catch (error) { next(error); }
});
const id = (req: import('express').Request) => req.clientId!;
clientRouter.get('/auth/me', async (req, res, next) => { try { res.set('Cache-Control', 'private, no-store').json({ data: await prisma.user.findUnique({ where: { id: id(req) }, select: publicUser }) }); } catch (e) { next(e); } });

const profileInput = z.object({ name: z.string().trim().min(1).max(100), phone: z.string().trim().max(32).optional().nullable(), address: z.string().trim().max(300).optional().nullable(), city: z.string().trim().max(100).optional().nullable(), vehicles: z.array(z.object({ id: z.string().max(80).optional(), brand: z.string().trim().min(1).max(80), model: z.string().trim().min(1).max(80), year: z.number().int().min(1900).max(2100), engine: z.string().max(80).optional() })).max(30).optional() });
clientRouter.patch('/profile', async (req, res, next) => { try { const p = profileInput.parse(req.body); const data = await prisma.clientProfile.upsert({ where: { userId: id(req) }, create: { userId: id(req), ...p, vehicles: p.vehicles ?? [] }, update: { ...p, vehicles: p.vehicles ?? [] } }); res.json({ data }); } catch (e) { next(e); } });
clientRouter.get('/categories', async (_req, res, next) => { try { res.json({ data: await prisma.marketplaceCategory.findMany({ where: { isActive: true }, select: { id: true, name: true, description: true, icon: true }, orderBy: { name: 'asc' } }) }); } catch (e) { next(e); } });
clientRouter.get('/governorates', (_req, res) => res.json({ data: TUNISIAN_GOVERNORATES }));

const requestFieldsInput = z.object({ partName: z.string().trim().min(1).max(160), category: z.string().trim().min(1).max(80), oemReference: z.string().trim().max(100).nullable().optional(), referenceUnavailable: z.boolean().optional(), brand: z.string().trim().min(1).max(100).optional(), vehicleMake: z.string().trim().min(1).max(80), vehicleModel: z.string().trim().min(1).max(80), vehicleEngine: z.string().trim().min(1).max(80).optional(), vehicleYear: z.number().int().min(1900).max(2100).optional(), condition: z.nativeEnum(PartCondition).default(PartCondition.EITHER), quantity: z.number().int().min(1).max(10000).default(1), minBudget: z.number().finite().nonnegative().max(999999999).optional(), maxBudget: z.number().finite().nonnegative().max(999999999).optional(), governorate: z.enum(TUNISIAN_GOVERNORATES), location: z.string().trim().min(1).max(150), deliveryMethod: z.enum(['delivery','pickup','both']).optional(), description: z.string().max(4000).optional() });
const budgetRangeIsValid = <T extends { minBudget?: number; maxBudget?: number }>(v: T) => v.minBudget === undefined || v.maxBudget === undefined || v.minBudget <= v.maxBudget;
const requestInput = requestFieldsInput.refine(budgetRangeIsValid, { message: 'Minimum budget must not exceed maximum budget.' });
const createRequestInput = requestFieldsInput.extend({ photoIds: z.array(z.string().min(1).max(80)).max(5).default([]) })
  .refine(budgetRangeIsValid, { message: 'Minimum budget must not exceed maximum budget.' })
  .refine((v) => Boolean(v.oemReference?.trim()) !== (v.referenceUnavailable === true), { message: 'Enter a reference number or confirm that you do not have one.' })
  .refine((v) => new Set(v.photoIds).size === v.photoIds.length, { message: 'A photo cannot be attached more than once.' });
const requestFields = { id: true, clientId: true, partName: true, category: true, oemReference: true, referenceUnavailable: true, brand: true, vehicleMake: true, vehicleModel: true, vehicleEngine: true, vehicleYear: true, condition: true, quantity: true, minBudget: true, maxBudget: true, governorate: true, location: true, cancellationReason: true, deliveryMethod: true, description: true, status: true, createdAt: true, updatedAt: true, images: { select: requestImageFields, orderBy: { createdAt: 'asc' } }, _count: { select: { offers: true } } } as const;
clientRouter.get('/requests', async (req, res, next) => { try { const data = await prisma.marketplaceRequest.findMany({ where: { clientId: id(req) }, select: requestFields, orderBy: { createdAt: 'desc' } }); res.json({ data }); } catch (e) { next(e); } });
clientRouter.post('/requests', communicationLimiter, async (req, res, next) => {
  let submissionHash: string | undefined;
  try {
    const submissionKey = z.string().uuid().parse(req.get('Idempotency-Key'));
    const { photoIds, ...p } = createRequestInput.parse(req.body);
    submissionHash = createHash('sha256').update(JSON.stringify({ ...p, photoIds })).digest('hex');
    const knownCategory = await prisma.marketplaceCategory.findFirst({ where: { name: { equals: p.category, mode: 'insensitive' }, isActive: true }, select: { name: true } });
    if (knownCategory) p.category = knownCategory.name;
    if (await messageContactPolicyViolation(p)) return res.status(422).json(contactPolicyError);
    const data = await prisma.$transaction(async (tx) => {
      const created = await tx.marketplaceRequest.create({ data: {
        ...p, clientId: id(req), clientSubmissionKey: submissionKey, clientSubmissionHash: submissionHash, minBudget: p.minBudget === undefined ? undefined : new Prisma.Decimal(p.minBudget),
        maxBudget: p.maxBudget === undefined ? undefined : new Prisma.Decimal(p.maxBudget),
      }, select: { id: true } });
      if (photoIds.length) {
        const attached = await tx.requestImage.updateMany({ where: { id: { in: photoIds }, clientId: id(req), requestId: null }, data: { requestId: created.id } });
        if (attached.count !== photoIds.length) throw Object.assign(new Error('One or more photos are no longer available.'), { code: 'INVALID_REQUEST_PHOTO' });
      }
      return tx.marketplaceRequest.findUniqueOrThrow({ where: { id: created.id }, select: requestFields });
    });
    res.status(201).json({ data });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      try {
        const submissionKey = z.string().uuid().parse(req.get('Idempotency-Key'));
        const existing = await prisma.marketplaceRequest.findFirst({ where: { clientId: clientId(req), clientSubmissionKey: submissionKey }, select: { ...requestFields, clientSubmissionHash: true } });
        if (existing && existing.clientSubmissionHash !== submissionHash) return res.status(409).json({ error: { code: 'IDEMPOTENCY_KEY_REUSED', message: 'This submission key was already used for different request details. Start a new request submission.' } });
        if (existing) { const { clientSubmissionHash: _submissionHash, ...data } = existing; return res.status(200).json({ data }); }
      } catch (lookupError) { return next(lookupError); }
    }
    next(e);
  }
});
clientRouter.get('/requests/:requestId', async (req, res, next) => {
  try {
    const data = await prisma.marketplaceRequest.findFirst({
      where: { id: String(req.params.requestId), clientId: id(req) },
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
clientRouter.patch('/requests/:requestId', communicationLimiter, async (req, res, next) => { try { const p = requestInput.partial().parse(req.body); const request = await prisma.marketplaceRequest.findFirst({ where: { id: String(req.params.requestId), clientId: id(req), status: RequestStatus.PUBLISHED, offers: { none: {} } }, select: { id: true, minBudget: true, maxBudget: true, oemReference: true, referenceUnavailable: true } }); if (!request) return res.status(409).json({ error: { code: 'REQUEST_LOCKED', message: 'Only requests without offers can be edited.' } }); const nextReference = p.oemReference !== undefined ? p.oemReference : request.oemReference; const nextReferenceUnavailable = p.referenceUnavailable ?? request.referenceUnavailable; if (Boolean(nextReference?.trim()) === nextReferenceUnavailable) return res.status(422).json({ error: { code: 'REFERENCE_REQUIRED', message: 'Enter a reference number or confirm that you do not have one.' } }); if (await messageContactPolicyViolation(p)) return res.status(422).json(contactPolicyError); const knownCategory = p.category === undefined ? undefined : await prisma.marketplaceCategory.findFirst({ where: { name: { equals: p.category, mode: 'insensitive' }, isActive: true }, select: { name: true } }); const minBudget = p.minBudget ?? request.minBudget?.toNumber(); const maxBudget = p.maxBudget ?? request.maxBudget?.toNumber(); if (minBudget !== undefined && maxBudget !== undefined && minBudget > maxBudget) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Minimum budget must not exceed maximum budget.' } }); const data = await prisma.marketplaceRequest.update({ where: { id: request.id }, data: { ...p, ...(p.category !== undefined ? { category: knownCategory?.name ?? p.category } : {}), ...(p.minBudget !== undefined ? { minBudget: new Prisma.Decimal(p.minBudget) } : {}), ...(p.maxBudget !== undefined ? { maxBudget: new Prisma.Decimal(p.maxBudget) } : {}) }, select: requestFields }); res.json({ data }); } catch (e) { next(e); } });
clientRouter.post('/requests/:requestId/cancel', async (req, res, next) => {
  try {
    const { reason } = z.object({ reason: z.string().trim().min(1).max(500).optional() }).parse(req.body ?? {});
    const cancelled = await prisma.$transaction(async (tx) => {
      const current = await tx.marketplaceRequest.findFirst({ where: { id: String(req.params.requestId), clientId: id(req) }, select: { id: true, status: true } });
      if (!current || (current.status !== RequestStatus.PUBLISHED && current.status !== RequestStatus.OFFERS_RECEIVED)) return false;
      if (current.status === RequestStatus.OFFERS_RECEIVED && !reason) {
        throw Object.assign(new Error('Choose a reason before cancelling a request that has offers.'), { code: 'CANCELLATION_REASON_REQUIRED' });
      }
      const claimed = await tx.marketplaceRequest.updateMany({
        where: { id: current.id, clientId: id(req), status: current.status },
        data: { status: RequestStatus.CANCELLED, cancellationReason: reason ?? null },
      });
      if (!claimed.count) return false;

      const pending = await tx.offer.findMany({
        where: { requestId: String(req.params.requestId), status: 'PENDING' },
        select: { id: true, sellerId: true, partName: true },
      });
      if (pending.length) {
        await tx.offer.updateMany({ where: { id: { in: pending.map((offer) => offer.id) }, status: 'PENDING' }, data: { status: 'REJECTED' } });
        await tx.notification.createMany({ data: pending.map((offer) => ({
          userId: offer.sellerId,
          type: 'request_cancelled',
          title: 'Request cancelled',
          message: `The client cancelled the request for ${offer.partName}; your pending offer is no longer actionable.`,
          link: `/seller/offers/${offer.id}`,
        })) });
      }
      return true;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if (!cancelled) return res.status(409).json({ error: { code: 'REQUEST_NOT_CANCELLABLE', message: 'This request can no longer be cancelled.' } });
    res.json({ data: { id: String(req.params.requestId), status: RequestStatus.CANCELLED } });
  } catch (e) { next(e); }
});

clientRouter.get('/offers', async (req, res, next) => { try { const data = await prisma.offer.findMany({ where: { request: { clientId: id(req) } }, include: { seller: { select: { id: true, profile: { select: { shopName: true, verificationStatus: true, city: true } } } }, order: { select: { status: true } }, request: { select: { id: true, partName: true, status: true, category: true, vehicleMake: true, vehicleModel: true, vehicleEngine: true, vehicleYear: true, governorate: true, location: true } } }, orderBy: { createdAt: 'desc' } }); res.json({ data }); } catch (e) { next(e); } });
clientRouter.post('/offers/:offerId/conversation', async (req, res, next) => {
  try {
    const offer = await prisma.offer.findFirst({ where: { id: String(req.params.offerId), request: { clientId: id(req) } }, select: { sellerId: true, requestId: true } });
    if (!offer) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Offer not found.' } });
    const existing = await prisma.conversation.findFirst({ where: { requestId: offer.requestId, participants: { some: { userId: id(req) } }, AND: [{ participants: { some: { userId: offer.sellerId } } }] }, select: { id: true } });
    if (existing) return res.json({ data: existing });
    const conversation = await prisma.conversation.create({ data: { requestId: offer.requestId, participants: { create: [{ userId: id(req) }, { userId: offer.sellerId }] } }, select: { id: true } });
    res.status(201).json({ data: conversation });
  } catch (e) { next(e); }
});
clientRouter.post('/offers/:offerId/reject', async (req, res, next) => { try { const offer = await prisma.offer.findFirst({ where: { id: String(req.params.offerId), status: 'PENDING', expiresAt: { gt: new Date() }, request: { clientId: id(req), status: { in: ['PUBLISHED','OFFERS_RECEIVED','OFFER_ACCEPTED'] } } }, select: { id: true, sellerId: true, partName: true } }); if (!offer) return res.status(409).json({ error: { code: 'OFFER_NOT_ACTIONABLE', message: 'This offer can no longer be rejected.' } }); const result = await prisma.$transaction(async tx => { const changed = await tx.offer.updateMany({ where: { id: offer.id, status: 'PENDING', expiresAt: { gt: new Date() } }, data: { status: 'REJECTED' } }); if (!changed.count) return false; await tx.notification.create({ data: { userId: offer.sellerId, type: 'offer_rejected', title: 'Offer rejected', message: `The client rejected your offer for ${offer.partName}.`, link: `/seller/offers/${offer.id}` } }); return true; }); if (!result) return res.status(409).json({ error: { code: 'OFFER_NOT_ACTIONABLE', message: 'This offer can no longer be rejected.' } }); res.json({ data: { id: offer.id, status: 'REJECTED' } }); } catch (e) { next(e); } });
clientRouter.post('/offers/:offerId/accept', async (req, res, next) => {
  try {
    const order = await prisma.$transaction(async tx => {
    const offer = await tx.offer.findFirst({ where: { id: String(req.params.offerId), status: 'PENDING', expiresAt: { gt: new Date() }, request: { clientId: id(req), status: { in: ['PUBLISHED','OFFERS_RECEIVED'] } }, seller: { isActive: true, profile: { is: { verificationStatus: 'verified' } } } }, include: { request: true } });
      if (!offer) throw Object.assign(new Error('Offer is unavailable.'), { status: 409, code: 'OFFER_NOT_ACTIONABLE' });
      const claimed = await tx.marketplaceRequest.updateMany({ where: { id: offer.requestId, clientId: id(req), status: { in: [RequestStatus.PUBLISHED, RequestStatus.OFFERS_RECEIVED] } }, data: { status: RequestStatus.OFFER_ACCEPTED } });
      if (!claimed.count) throw Object.assign(new Error('Another offer was already accepted.'), { status: 409, code: 'OFFER_NOT_ACTIONABLE' });
      const accepted = await tx.offer.updateMany({ where: { id: offer.id, status: 'PENDING' }, data: { status: 'ACCEPTED' } });
      if (!accepted.count) throw Object.assign(new Error('Offer is no longer available.'), { status: 409, code: 'OFFER_NOT_ACTIONABLE' });
      const created = await tx.order.create({ data: { sellerId: offer.sellerId, requestId: offer.requestId, offerId: offer.id, totalAmount: offer.price.mul(offer.quantity).add(offer.deliveryFee), deliveryInfo: offer.request.location ?? '' }, include: { offer: true } });
      await tx.orderEvent.create({ data: { orderId: created.id, status: 'OFFER_ACCEPTED', note: 'Offer accepted by client.' } });
      const conversation = await tx.conversation.create({ data: { requestId: offer.requestId, orderId: created.id, participants: { create: [{ userId: id(req) }, { userId: offer.sellerId }] } } });
      await tx.notification.create({ data: { userId: offer.sellerId, type: 'offer_accepted', title: 'Offer accepted', message: 'The client accepted your offer.', link: `/seller/orders/${created.id}` } });
      return { ...created, conversationId: conversation.id };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    res.status(201).json({ data: order });
  } catch (e) { next(e); }
});

clientRouter.get('/orders', async (req, res, next) => { try { const data = await prisma.order.findMany({ where: { request: { clientId: id(req) } }, include: { offer: true, seller: { select: { id: true, profile: { select: { shopName: true } } } }, request: { select: { partName: true, location: true, deliveryMethod: true, quantity: true, governorate: true } }, events: { orderBy: { createdAt: 'asc' } } }, orderBy: { createdAt: 'desc' } }); res.json({ data }); } catch (e) { next(e); } });
clientRouter.get('/orders/:orderId', async (req, res, next) => { try { const data = await prisma.order.findFirst({ where: { id: String(req.params.orderId), request: { clientId: id(req) } }, include: { offer: true, seller: { select: { id: true, profile: { select: { shopName: true, city: true } } } }, request: true, events: { orderBy: { createdAt: 'asc' } } } }); if (!data) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Order not found.' } }); res.json({ data }); } catch (e) { next(e); } });
clientRouter.post('/orders/:orderId/cancel', async (req, res, next) => {
  try {
    const order = await prisma.$transaction(async tx => {
      const current = await tx.order.findFirst({ where: { id: String(req.params.orderId), request: { clientId: id(req) }, status: { in: ['OFFER_ACCEPTED','SELLER_CONFIRMED'] } }, select: { id: true, requestId: true, sellerId: true, offerId: true } });
      if (!current) throw Object.assign(new Error('This order is no longer eligible for cancellation.'), { code: 'ORDER_NOT_CANCELLABLE' });
      const updated = await tx.order.updateMany({ where: { id: current.id, status: { in: ['OFFER_ACCEPTED','SELLER_CONFIRMED'] } }, data: { status: 'CANCELLED' } });
      if (!updated.count) throw Object.assign(new Error('This order is no longer eligible for cancellation.'), { code: 'ORDER_NOT_CANCELLABLE' });
      const alternatives = await tx.offer.count({ where: { requestId: current.requestId, status: 'PENDING', expiresAt: { gt: new Date() } } });
      const requestStatus = alternatives ? 'OFFERS_RECEIVED' : 'PUBLISHED';
      await tx.marketplaceRequest.update({ where: { id: current.requestId }, data: { status: requestStatus } });
      await tx.orderEvent.create({ data: { orderId: current.id, status: 'CANCELLED', note: 'Cancellation requested by client.' } });
      await tx.notification.create({ data: { userId: current.sellerId, type: 'order_cancelled', title: 'Order cancelled', message: 'The client cancelled this order.', link: `/seller/orders/${current.id}` } });
      await tx.notification.create({ data: { userId: current.sellerId, type: 'offer_closed', title: 'Accepted offer cancelled', message: 'The client cancelled the order created from your offer.', link: `/seller/offers/${current.offerId}` } });
      return { ...(await tx.order.findUnique({ where: { id: current.id } }))!, requestStatus };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    res.json({ data: order });
  } catch (e) { next(e); }
});
clientRouter.get('/conversations', async (req, res, next) => {
  try {
    const data = await prisma.conversation.findMany({
      where: { type: 'MARKETPLACE', participants: { some: { userId: id(req) } } },
      include: {
        request: { select: { id: true, partName: true } },
        order: { select: { id: true, status: true } },
        participants: { include: { user: { select: { id: true, role: true, clientProfile: { select: { name: true } }, profile: { select: { shopName: true, name: true } } } } } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json({ data });
  } catch (e) { next(e); }
});
clientRouter.get('/conversations/:conversationId/messages', async (req, res, next) => { try { const member = await prisma.conversationParticipant.findUnique({ where: { conversationId_userId: { conversationId: String(req.params.conversationId), userId: id(req) } } }); if (!member) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Conversation not found.' } }); res.json({ data: await prisma.message.findMany({ where: { conversationId: member.conversationId }, orderBy: { createdAt: 'asc' }, take: 500 }) }); } catch (e) { next(e); } });
clientRouter.post('/conversations/:conversationId/messages', communicationLimiter, async (req, res, next) => { try { const { body } = z.object({ body: z.string().trim().min(1).max(4000) }).parse(req.body); const member = await prisma.conversationParticipant.findUnique({ where: { conversationId_userId: { conversationId: String(req.params.conversationId), userId: id(req) } } }); if (!member) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Conversation not found.' } }); if (await messageContactPolicyViolation(body)) return res.status(422).json(contactPolicyError); res.status(201).json({ data: await prisma.message.create({ data: { conversationId: member.conversationId, senderId: id(req), body } }) }); } catch (e) { next(e); } });
clientRouter.get('/notifications', async (req, res, next) => { try { res.json({ data: await prisma.notification.findMany({ where: { userId: id(req) }, orderBy: { createdAt: 'desc' }, take: 100 }) }); } catch (e) { next(e); } });
clientRouter.patch('/notifications/read-all', async (req, res, next) => { try { const result = await prisma.notification.updateMany({ where: { userId: id(req), readAt: null }, data: { readAt: new Date() } }); res.json({ data: { updated: result.count } }); } catch (e) { next(e); } });
clientRouter.patch('/notifications/:notificationId/read', async (req, res, next) => { try { const result = await prisma.notification.updateMany({ where: { id: String(req.params.notificationId), userId: id(req) }, data: { readAt: new Date() } }); if (!result.count) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Notification not found.' } }); res.status(204).end(); } catch (e) { next(e); } });
