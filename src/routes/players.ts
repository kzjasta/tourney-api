import { Router } from 'express';
import { parsePagination } from '../lib/pagination';
import { asyncHandler } from '../lib/asyncHandler';
import {
  createPlayerSchema,
  updatePlayerSchema,
  type CreatePlayerInput,
  type UpdatePlayerInput,
} from '../schemas/player';
import { validateBody } from '../middleware/validate';
import { currentUser } from '../middleware/auth';
import {
  createPlayer,
  deletePlayer,
  getPlayer,
  listPlayers,
  updatePlayer,
} from '../services/player.service';

const router = Router();

/**
 * POST /players - Create a player
 * Body: { firstName, lastName (required); position?, dateOfBirth?, jerseyNumber?, height?, team? }
 */
router.post(
  '/',
  validateBody(createPlayerSchema),
  asyncHandler(async (req, res) => {
    const player = await createPlayer(
      currentUser(req),
      req.body as CreatePlayerInput
    );
    res.status(201).json(player);
  })
);

/**
 * GET /players - List players (optional ?teamId=, ?limit=, ?offset=)
 * Without ?teamId= this returns players on the caller's teams plus any they created.
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { teamId } = req.query;
    const players = await listPlayers(currentUser(req), {
      teamRef: teamId ? String(teamId) : undefined,
      ...parsePagination(req.query),
    });
    res.json(players);
  })
);

/**
 * GET /players/:id - Get one player by id (uuid or ObjectId)
 */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const player = await getPlayer(currentUser(req), req.params.id);
    res.json(player);
  })
);

/**
 * PUT /players/:id - Update player (partial). Sync Team.players when team changes.
 */
router.put(
  '/:id',
  validateBody(updatePlayerSchema),
  asyncHandler(async (req, res) => {
    const player = await updatePlayer(
      currentUser(req),
      req.params.id,
      req.body as UpdatePlayerInput
    );
    res.json(player);
  })
);

/**
 * DELETE /players/:id - Remove from team's players (if any), then delete player.
 */
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await deletePlayer(currentUser(req), req.params.id);
    res.status(204).send();
  })
);

export default router;
