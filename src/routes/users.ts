import { Router, Request, Response, NextFunction } from 'express';
import User from '../models/User';
import Team from '../models/Team';
import { idQuery } from '../lib/idQuery';
import { HttpError } from '../lib/httpError';
import { parseQueryParams } from '../utils/utils';
import {
  assertSelfOrAdmin,
  currentUser,
  requireRole,
} from '../middleware/auth';

const router = Router();

const userResponse = (user: {
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

/**
 * GET /users - List users (admin only; optional ?limit=, ?offset=)
 */
router.get(
  '/',
  requireRole('admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { limit, offset } = parseQueryParams(req.query);
      const users = await User.find()
        .select('uuid username email role')
        .skip(offset)
        .limit(limit)
        .lean();
      res.json(users);
    } catch (err: unknown) {
      next(err);
    }
  }
);

/**
 * GET /users/:id - Get one user by id (self or admin)
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const auth = currentUser(req);
    const user = await User.findOne(idQuery(req.params.id))
      .select('uuid username email role')
      .lean();
    if (!user) {
      throw new HttpError(404, 'User not found');
    }
    assertSelfOrAdmin(user._id as never, auth);
    res.json(userResponse(user as never));
  } catch (err: unknown) {
    next(err);
  }
});

/**
 * PUT /users/:id - Update user (self or admin; partial: username?, email?)
 */
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const auth = currentUser(req);
    const user = await User.findOne(idQuery(req.params.id)).exec();
    if (!user) {
      throw new HttpError(404, 'User not found');
    }
    assertSelfOrAdmin(user._id as never, auth);

    const { username, email, role, password, tokenVersion } = req.body;
    if (
      role !== undefined ||
      password !== undefined ||
      tokenVersion !== undefined
    ) {
      throw new HttpError(
        400,
        'role, password and tokenVersion cannot be changed here'
      );
    }

    if (username !== undefined) {
      if (typeof username !== 'string' || !username.trim()) {
        throw new HttpError(400, 'Username must be a non-empty string');
      }
      user.username = username.trim();
    }
    if (email !== undefined) {
      if (typeof email !== 'string' || !email.trim()) {
        throw new HttpError(400, 'Email must be a non-empty string');
      }
      user.email = email.trim().toLowerCase();
    }

    await user.save();
    res.json(userResponse(user));
  } catch (err: unknown) {
    next(err);
  }
});

/**
 * DELETE /users/:id - Delete user (self or admin; 409 if user owns teams)
 */
router.delete(
  '/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const auth = currentUser(req);
      const user = await User.findOne(idQuery(req.params.id)).exec();
      if (!user) {
        throw new HttpError(404, 'User not found');
      }
      assertSelfOrAdmin(user._id as never, auth);

      const teamCount = await Team.countDocuments({
        createdBy: user._id,
      }).exec();
      if (teamCount > 0) {
        throw new HttpError(409, 'Cannot delete user that owns teams');
      }

      await User.deleteOne({ _id: user._id }).exec();
      res.status(204).send();
    } catch (err: unknown) {
      next(err);
    }
  }
);

export default router;
