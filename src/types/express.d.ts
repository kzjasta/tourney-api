import mongoose from 'mongoose';
import { UserRole } from '../models/User';

export interface AuthUser {
  id: mongoose.Types.ObjectId;
  role: UserRole;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export {};
