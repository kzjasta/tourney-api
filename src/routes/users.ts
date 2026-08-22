import { Router, Request, Response } from 'express';
import User from '../models/User';
import Team from '../models/Team';
import { idQuery } from '../lib/idQuery';
import { parseQueryParams, handleGenericError } from '../utils/utils';

const router = Router();

const userResponse = (user: any) => ({
  uuid: user.uuid,
  username: user.username,
  email: user.email,
});

/**
 * POST /users - Create a new user
 * Body: { username: string, email: string }
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { username, email } = req.body;

    if (!username || typeof username !== 'string' || !username.trim()) {
      return res.status(400).json({ error: 'Username is required' });
    }

    if (!email || typeof email !== 'string' || !email.trim()) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = await User.create({
      username: username.trim(),
      email: email.trim().toLowerCase(),
    });

    res.status(201).json(userResponse(user));
  } catch (err: unknown) {
    console.error(err);
    if (err && typeof err === 'object' && 'code' in err && err.code === 11000) {
      return res.status(409).json({
        error: 'A user with this email or username already exists',
      });
    }
    res.status(500).json({ error: 'Failed to create user' });
  }
});

/**
 * GET /users - List users (optional ?limit=, ?offset=)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { limit, offset } = parseQueryParams(req.query);
    const users = await User.find()
      .select('uuid username email')
      .skip(offset)
      .limit(limit)
      .lean();
    res.json(users);
  } catch (err: unknown) {
    handleGenericError(res, err, 'Failed to list users');
  }
});

/**
 * GET /users/:id - Get one user by id (uuid or ObjectId)
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const user = await User.findOne(idQuery(req.params.id))
      .select('uuid username email')
      .lean();
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (err: unknown) {
    handleGenericError(res, err, 'Failed to get user');
  }
});

/**
 * PUT /users/:id - Update user (partial: username?, email?)
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const user = await User.findOne(idQuery(req.params.id)).exec();
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { username, email } = req.body;
    if (username !== undefined) {
      if (typeof username !== 'string' || !username.trim()) {
        return res
          .status(400)
          .json({ error: 'Username must be a non-empty string' });
      }
      user.username = username.trim();
    }
    if (email !== undefined) {
      if (typeof email !== 'string' || !email.trim()) {
        return res
          .status(400)
          .json({ error: 'Email must be a non-empty string' });
      }
      user.email = email.trim().toLowerCase();
    }

    await user.save();
    res.json(userResponse(user));
  } catch (err: unknown) {
    console.error(err);
    if (err && typeof err === 'object' && 'code' in err && err.code === 11000) {
      return res.status(409).json({
        error: 'A user with this email or username already exists',
      });
    }
    res.status(500).json({ error: 'Failed to update user' });
  }
});

/**
 * DELETE /users/:id - Delete user (409 if user owns teams)
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const user = await User.findOne(idQuery(req.params.id)).exec();
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const teamCount = await Team.countDocuments({ createdBy: user._id }).exec();
    if (teamCount > 0) {
      return res
        .status(409)
        .json({ error: 'Cannot delete user that owns teams' });
    }

    await User.deleteOne({ _id: user._id }).exec();
    res.status(204).send();
  } catch (err: unknown) {
    handleGenericError(res, err, 'Failed to delete user');
  }
});

export default router;
