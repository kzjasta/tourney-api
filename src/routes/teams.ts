import { Router, Request, Response, NextFunction } from 'express';
import Team from '../models/Team';
import Player from '../models/Player';
import User from '../models/User';
import { idQuery } from '../lib/idQuery';
import { HttpError } from '../lib/httpError';
import { resolveId } from '../lib/resolveId';
import {
  createTeamSchema,
  updateTeamSchema,
  type CreateTeamInput,
  type UpdateTeamInput,
} from '../schemas/team';
import { validateBody } from '../middleware/validate';
import { populateTeam } from '../serializers/team';
import { currentUser, isAdmin } from '../middleware/auth';

const router = Router();

/**
 * POST /teams - Create a team owned by the authenticated user
 * Body: { name: string, coach?: string }
 */
router.post(
  '/',
  validateBody(createTeamSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const auth = currentUser(req);
      const { name, coach } = req.body as CreateTeamInput;

      const team = await Team.create({
        name,
        coach: coach || undefined,
        createdBy: auth.id,
        players: [],
      });

      const populated = await populateTeam(Team.findById(team._id));
      res.status(201).json(populated);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /teams - List the caller's teams (admins may pass ?userId=)
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const auth = currentUser(req);
    const { userId } = req.query;

    let ownerId = auth.id;
    if (userId) {
      if (!isAdmin(auth)) {
        throw new HttpError(403, "Only admins may list another user's teams");
      }
      const resolved = await resolveId(User, String(userId));
      if (!resolved) {
        throw new HttpError(404, 'User not found');
      }
      ownerId = resolved;
    }

    const teams = await populateTeam(Team.find({ createdBy: ownerId }));
    res.json(teams);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /teams/:id - Get one owned team by id (uuid or ObjectId)
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const auth = currentUser(req);
    const filter = isAdmin(auth)
      ? idQuery(req.params.id)
      : { ...idQuery(req.params.id), createdBy: auth.id };

    const team = await populateTeam(Team.findOne(filter));
    if (!team) {
      throw new HttpError(404, 'Team not found');
    }
    res.json(team);
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /teams/:id - Update an owned team (partial: name?, coach?)
 */
router.put(
  '/:id',
  validateBody(updateTeamSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const auth = currentUser(req);
      const team = await Team.findOne(idQuery(req.params.id)).exec();
      if (!team) {
        throw new HttpError(404, 'Team not found');
      }
      if (!isAdmin(auth) && !team.createdBy.equals(auth.id)) {
        throw new HttpError(403, 'You do not own this team');
      }

      const { name, coach } = req.body as UpdateTeamInput;
      if (name !== undefined) {
        team.name = name;
      }
      if (coach !== undefined) {
        team.coach = coach || undefined;
      }

      await team.save();
      const populated = await populateTeam(Team.findById(team._id));
      res.json(populated);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /teams/:id - Delete an owned team and unset team on its players
 */
router.delete(
  '/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const auth = currentUser(req);
      const team = await Team.findOne(idQuery(req.params.id)).exec();
      if (!team) {
        throw new HttpError(404, 'Team not found');
      }
      if (!isAdmin(auth) && !team.createdBy.equals(auth.id)) {
        throw new HttpError(403, 'You do not own this team');
      }

      await Player.updateMany(
        { team: team._id },
        { $unset: { team: 1 } }
      ).exec();
      await Team.deleteOne({ _id: team._id }).exec();
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

export default router;
