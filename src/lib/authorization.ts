import mongoose from 'mongoose';
import { HttpError } from './httpError';
import type { AuthUser } from '../types/express';

export const isAdmin = (user: AuthUser): boolean => user.role === 'admin';

export const assertSelfOrAdmin = (
  targetUserId: mongoose.Types.ObjectId,
  user: AuthUser
) => {
  if (isAdmin(user) || targetUserId.equals(user.id)) return;
  throw new HttpError(403, 'You may only access your own account');
};
