import { Router, Request, Response, NextFunction } from 'express';
import {
  createTeamSchema,
  updateTeamSchema,
  type CreateTeamInput,
  type UpdateTeamInput,
} from '../schemas/team';
import { validateBody } from '../middleware/validate';
import { currentUser } from '../middleware/auth';
import {
  createTeam,
  deleteTeam,
  getTeam,
  listTeams,
  updateTeam,
} from '../services/team.service';

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
      const team = await createTeam(
        currentUser(req),
        req.body as CreateTeamInput
      );
      res.status(201).json(team);
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
    const { userId } = req.query;
    const teams = await listTeams(
      currentUser(req),
      userId ? String(userId) : undefined
    );
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
    const team = await getTeam(currentUser(req), req.params.id);
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
      const team = await updateTeam(
        currentUser(req),
        req.params.id,
        req.body as UpdateTeamInput
      );
      res.json(team);
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
      await deleteTeam(currentUser(req), req.params.id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

export default router;
