import { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import { HttpError } from '../lib/httpError';
import { verifyAccessToken } from '../lib/tokens';
import { UserRole } from '../models/User';
import type { AuthUser } from '../types/auth';

const readBearerToken = (req: Request): string | null => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  return token.length > 0 ? token : null;
};

const toAuthUser = (token: string): AuthUser => {
  const payload = verifyAccessToken(token);
  if (!mongoose.Types.ObjectId.isValid(payload.sub)) {
    throw new HttpError(401, 'Invalid or expired token');
  }
  return {
    id: new mongoose.Types.ObjectId(payload.sub),
    role: payload.role,
  };
};

export const requireAuth = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  const token = readBearerToken(req);
  if (!token) {
    return next(new HttpError(401, 'Authentication required'));
  }
  try {
    req.user = toAuthUser(token);
    next();
  } catch {
    next(new HttpError(401, 'Invalid or expired token'));
  }
};

/** Attaches req.user when a valid token is present, but never rejects. */
export const optionalAuth = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  const token = readBearerToken(req);
  if (token) {
    try {
      req.user = toAuthUser(token);
    } catch {
      // Anonymous request; downstream handlers decide what is visible.
    }
  }
  next();
};

export const requireRole =
  (...roles: UserRole[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new HttpError(401, 'Authentication required'));
    }
    if (!roles.includes(req.user.role)) {
      return next(new HttpError(403, 'Insufficient permissions'));
    }
    next();
  };

/** Narrows req.user for handlers mounted behind requireAuth. */
export const currentUser = (req: Request): AuthUser => {
  if (!req.user) {
    throw new HttpError(401, 'Authentication required');
  }
  return req.user;
};
