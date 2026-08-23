import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { config } from '../config/env';
import { UserRole } from '../models/User';

export interface AccessTokenPayload {
  sub: string;
  role: UserRole;
}

export interface RefreshTokenPayload {
  sub: string;
  tv: number;
}

interface SignableUser {
  _id: mongoose.Types.ObjectId | unknown;
  role: UserRole;
  tokenVersion: number;
}

export const signAccessToken = (user: SignableUser): string =>
  jwt.sign(
    { sub: String(user._id), role: user.role },
    config.accessTokenSecret,
    { expiresIn: config.accessTokenTtl } as jwt.SignOptions
  );

export const signRefreshToken = (user: SignableUser): string =>
  jwt.sign(
    { sub: String(user._id), tv: user.tokenVersion ?? 0 },
    config.refreshTokenSecret,
    { expiresIn: config.refreshTokenTtl } as jwt.SignOptions
  );

export const verifyAccessToken = (token: string): AccessTokenPayload =>
  jwt.verify(token, config.accessTokenSecret) as AccessTokenPayload;

export const verifyRefreshToken = (token: string): RefreshTokenPayload =>
  jwt.verify(token, config.refreshTokenSecret) as RefreshTokenPayload;
