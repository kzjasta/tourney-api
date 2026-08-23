import { Router, Request, Response, NextFunction } from 'express';
import { parsePagination } from '../lib/pagination';
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
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const player = await createPlayer(
        currentUser(req),
        req.body as CreatePlayerInput
      );
      res.status(201).json(player);
    } catch (err: unknown) {
      next(err);
    }
  }
);

/**
 * GET /players - List players (optional ?teamId=, ?limit=, ?offset=)
 * Without ?teamId= this returns players on the caller's teams plus any they created.
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { teamId } = req.query;
    const players = await listPlayers(currentUser(req), {
      teamRef: teamId ? String(teamId) : undefined,
      ...parsePagination(req.query),
    });
    res.json(players);
  } catch (err: unknown) {
    next(err);
  }
});

/**
 * GET /players/:id - Get one player by id (uuid or ObjectId)
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const player = await getPlayer(currentUser(req), req.params.id);
    res.json(player);
  } catch (err: unknown) {
    next(err);
  }
});

/**
 * PUT /players/:id - Update player (partial). Sync Team.players when team changes.
 */
router.put(
  '/:id',
  validateBody(updatePlayerSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const player = await updatePlayer(
        currentUser(req),
        req.params.id,
        req.body as UpdatePlayerInput
      );
      res.json(player);
    } catch (err: unknown) {
      next(err);
    }
  }
);

/**
 * DELETE /players/:id - Remove from team's players (if any), then delete player.
 */
router.delete(
  '/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await deletePlayer(currentUser(req), req.params.id);
      res.status(204).send();
    } catch (err: unknown) {
      next(err);
    }
  }
);

export default router;
