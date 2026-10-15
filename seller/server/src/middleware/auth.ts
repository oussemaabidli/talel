import { createHash } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../db.js';

declare global {
  namespace Express {
    interface Request { sellerId?: string; clientId?: string; }
  }
}

export async function requireClient(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.signedCookies?.talel_session as string | undefined;
    if (!token) return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Authentication required.' } });
    const session = await prisma.session.findUnique({ where: { tokenHash: createHash('sha256').update(token).digest('hex') }, select: { userId: true, expiresAt: true, user: { select: { role: true, isActive: true } } } });
    if (!session || session.expiresAt <= new Date() || session.user.role !== 'CLIENT' || !session.user.isActive) {
      res.clearCookie('talel_session', { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', path: '/' });
      return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Authentication required.' } });
    }
    req.clientId = session.userId;
    next();
  } catch (error) { next(error); }
}

export async function requireSeller(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.signedCookies?.talel_session as string | undefined;
    if (!token) return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Authentication required.' } });
    const session = await prisma.session.findUnique({ where: { tokenHash: createHash('sha256').update(token).digest('hex') }, select: { userId: true, expiresAt: true, user: { select: { role: true, isActive: true } } } });
    if (!session || session.expiresAt <= new Date() || session.user.role !== 'SELLER' || !session.user.isActive) {
      res.clearCookie('talel_session', { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', path: '/' });
      return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Authentication required.' } });
    }
    req.sellerId = session.userId;
    next();
  } catch (error) { next(error); }
}

export async function requireHost(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.signedCookies?.talel_session as string | undefined;
    if (!token) return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Authentication required.' } });
    const session = await prisma.session.findUnique({ where: { tokenHash: createHash('sha256').update(token).digest('hex') }, select: { userId: true, expiresAt: true, user: { select: { role: true, isActive: true } } } });
    if (!session || session.expiresAt <= new Date() || session.user.role !== 'HOST' || !session.user.isActive) {
      res.clearCookie('talel_session', { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', path: '/' });
      return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Host authentication required.' } });
    }
    req.hostId = session.userId;
    next();
  } catch (error) { next(error); }
}

declare global {
  namespace Express {
    interface Request { hostId?: string; }
  }
}

export async function requireApprovedSeller(req: Request, res: Response, next: NextFunction) {
  try {
    const profile = await prisma.sellerProfile.findUnique({ where: { userId: req.sellerId }, select: { verificationStatus: true } });
    if (profile?.verificationStatus !== 'verified') return res.status(403).json({ error: { code: 'SELLER_NOT_VERIFIED', message: 'This feature is available after seller verification.' } });
    next();
  } catch (error) { next(error); }
}
