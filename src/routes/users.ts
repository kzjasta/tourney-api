import { Router } from 'express';
import { parsePagination } from '../lib/pagination';
import { asyncHandler } from '../lib/asyncHandler';
import { updateUserSchema, type UpdateUserInput } from '../schemas/user';
import { validateBody } from '../middleware/validate';
import { currentUser, requireRole } from '../middleware/auth';
import { toPublicUser } from '../serializers/user';
import {
  deleteUser,
  getUser,
  listUsers,
  updateUser,
} from '../services/user.service';

const router = Router();

/**
 * GET /users - List users (admin only; optional ?limit=, ?offset=)
 */
router.get(
  '/',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const users = await listUsers(parsePagination(req.query));
    res.json(users.map(toPublicUser));
  })
);

/**
 * GET /users/:id - Get one user by id (self or admin)
 */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const user = await getUser(currentUser(req), req.params.id);
    res.json(toPublicUser(user));
  })
);

/**
 * PUT /users/:id - Update user (self or admin; partial: username?, email?)
 */
router.put(
  '/:id',
  validateBody(updateUserSchema),
  asyncHandler<UpdateUserInput>(async (req, res) => {
    const user = await updateUser(currentUser(req), req.params.id, req.body);
    res.json(toPublicUser(user));
  })
);

/**
 * DELETE /users/:id - Delete user (self or admin; 409 if user owns teams)
 */
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await deleteUser(currentUser(req), req.params.id);
    res.status(204).send();
  })
);

export default router;
