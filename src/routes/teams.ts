import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler';
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
  asyncHandler(async (req, res) => {
    const team = await createTeam(
      currentUser(req),
      req.body as CreateTeamInput
    );
    res.status(201).json(team);
  })
);

/**
 * GET /teams - List the caller's teams (admins may pass ?userId=)
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { userId } = req.query;
    const teams = await listTeams(
      currentUser(req),
      userId ? String(userId) : undefined
    );
    res.json(teams);
  })
);

/**
 * GET /teams/:id - Get one owned team by id (uuid or ObjectId)
 */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const team = await getTeam(currentUser(req), req.params.id);
    res.json(team);
  })
);

/**
 * PUT /teams/:id - Update an owned team (partial: name?, coach?)
 */
router.put(
  '/:id',
  validateBody(updateTeamSchema),
  asyncHandler(async (req, res) => {
    const team = await updateTeam(
      currentUser(req),
      req.params.id,
      req.body as UpdateTeamInput
    );
    res.json(team);
  })
);

/**
 * DELETE /teams/:id - Delete an owned team and unset team on its players
 */
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await deleteTeam(currentUser(req), req.params.id);
    res.status(204).send();
  })
);

export default router;
