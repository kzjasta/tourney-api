import { Router, Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { config } from '../config/env';
import { HttpError } from '../lib/httpError';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../lib/tokens';
import User from '../models/User';
import { currentUser, requireAuth } from '../middleware/auth';

const router = Router();

const REFRESH_COOKIE = 'refreshToken';

const credentialsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => config.isTest,
  message: { error: 'Too many attempts, please try again later' },
});

const publicUser = (user: {
  uuid: string;
  username: string;
  email: string;
  role: string;
}) => ({
  uuid: user.uuid,
  username: user.username,
  email: user.email,
  role: user.role,
});

const setRefreshCookie = (res: Response, token: string) => {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'strict',
    maxAge: config.refreshTokenMaxAgeMs,
    path: '/auth',
  });
};

/**
 * POST /auth/register - Create an account and issue tokens
 * Body: { username, email, password }
 */
router.post(
  '/register',
  credentialsLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { username, email, password } = req.body;

      if (!username || typeof username !== 'string' || !username.trim()) {
        throw new HttpError(400, 'Username is required');
      }
      if (!email || typeof email !== 'string' || !email.trim()) {
        throw new HttpError(400, 'Email is required');
      }
      if (typeof password !== 'string' || password.length < 8) {
        throw new HttpError(400, 'Password must be at least 8 characters');
      }

      const user = await User.create({
        username: username.trim(),
        email: email.trim().toLowerCase(),
        password,
      });

      setRefreshCookie(res, signRefreshToken(user));
      res.status(201).json({
        user: publicUser(user),
        accessToken: signAccessToken(user),
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /auth/login - Exchange credentials for tokens
 * Body: { email, password }
 */
router.post(
  '/login',
  credentialsLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body;

      if (typeof email !== 'string' || typeof password !== 'string') {
        throw new HttpError(400, 'Email and password are required');
      }

      const user = await User.findOne({ email: email.trim().toLowerCase() })
        .select('+password')
        .exec();

      // Same response for unknown email and wrong password: no user enumeration.
      if (!user || !(await user.comparePassword(password))) {
        throw new HttpError(401, 'Invalid credentials');
      }

      setRefreshCookie(res, signRefreshToken(user));
      res.json({
        user: publicUser(user),
        accessToken: signAccessToken(user),
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /auth/refresh - Issue a new access token from the refresh cookie
 */
router.post(
  '/refresh',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = req.cookies?.[REFRESH_COOKIE];
      if (!token || typeof token !== 'string') {
        throw new HttpError(401, 'Refresh token missing');
      }

      let payload;
      try {
        payload = verifyRefreshToken(token);
      } catch {
        throw new HttpError(401, 'Invalid or expired refresh token');
      }

      const user = await User.findById(payload.sub).exec();
      if (!user || user.tokenVersion !== payload.tv) {
        throw new HttpError(401, 'Refresh token has been revoked');
      }

      setRefreshCookie(res, signRefreshToken(user));
      res.json({ accessToken: signAccessToken(user) });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /auth/logout - Revoke every outstanding refresh token for the user
 */
router.post(
  '/logout',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const auth = currentUser(req);
      await User.updateOne({ _id: auth.id }, { $inc: { tokenVersion: 1 } });
      res.clearCookie(REFRESH_COOKIE, { path: '/auth' });
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /auth/me - Current authenticated user
 */
router.get(
  '/me',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const auth = currentUser(req);
      const user = await User.findById(auth.id)
        .select('uuid username email role')
        .lean();
      if (!user) {
        throw new HttpError(404, 'User not found');
      }
      res.json(user);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
