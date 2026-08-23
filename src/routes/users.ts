import { Router, Request, Response, NextFunction } from 'express';
import { parsePagination } from '../lib/pagination';
import { updateUserSchema, type UpdateUserInput } from '../schemas/user';
import { validateBody } from '../middleware/validate';
import { currentUser, requireRole } from '../middleware/auth';
import {
  deleteUser,
  getUser,
  listUsers,
  updateUser,
} from '../services/user.service';

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
      const users = await listUsers(parsePagination(req.query));
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
    const user = await getUser(currentUser(req), req.params.id);
    res.json(userResponse(user as never));
  } catch (err: unknown) {
    next(err);
  }
});

/**
 * PUT /users/:id - Update user (self or admin; partial: username?, email?)
 */
router.put(
  '/:id',
  validateBody(updateUserSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await updateUser(
        currentUser(req),
        req.params.id,
        req.body as UpdateUserInput
      );
      res.json(userResponse(user));
    } catch (err: unknown) {
      next(err);
    }
  }
);

/**
 * DELETE /users/:id - Delete user (self or admin; 409 if user owns teams)
 */
router.delete(
  '/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await deleteUser(currentUser(req), req.params.id);
      res.status(204).send();
    } catch (err: unknown) {
      next(err);
    }
  }
);

export default router;
