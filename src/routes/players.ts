import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import Player from '../models/Player';
import Team from '../models/Team';
import { idQuery } from '../lib/idQuery';
import {
  resolveTeamId,
  parsePlayerBody,
  handleError,
  parseQueryParams,
  populatePlayer,
  syncTeamPlayers,
} from '../utils/utils';

const router = Router();

/**
 * POST /players - Create a player
 * Body: { firstName, lastName (required); position?, dateOfBirth?, jerseyNumber?, height?, team? }
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { firstName, lastName, ...rest } = parsePlayerBody(req.body);
    if (!firstName || !lastName) {
      return res
        .status(400)
        .json({ error: 'First name and last name are required' });
    }

    let teamObjectId: mongoose.Types.ObjectId | null = null;
    if (rest.teamId) {
      teamObjectId = await resolveTeamId(String(rest.teamId));
      if (!teamObjectId) {
        return res.status(404).json({ error: 'Team not found' });
      }
    }

    const player = await Player.create({
      firstName,
      lastName,
      ...rest,
      team: teamObjectId ?? undefined,
    });

    if (teamObjectId) {
      await Team.updateOne(
        { _id: teamObjectId },
        { $addToSet: { players: player._id } }
      ).exec();
    }

    const populated = await populatePlayer(Player.findById(player._id));
    res.status(201).json(populated);
  } catch (err: unknown) {
    handleError(res, err, 'Failed to create player');
  }
});

/**
 * GET /players - List players (optional ?teamId=, ?limit=, ?offset=)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { teamId } = req.query;
    const { limit, offset } = parseQueryParams(req.query);
    const filter: mongoose.FilterQuery<unknown> = {};

    if (teamId && teamId !== '') {
      const tid = await resolveTeamId(String(teamId));
      if (!tid) {
        return res.status(404).json({ error: 'Team not found' });
      }
      filter.team = tid;
    }

    const players = await populatePlayer(
      Player.find(filter).skip(offset).limit(limit)
    );
    res.json(players);
  } catch (err: unknown) {
    handleError(res, err, 'Failed to list players');
  }
});

/**
 * GET /players/:id - Get one player by id (uuid or ObjectId)
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const player = await populatePlayer(Player.findOne(idQuery(req.params.id)));
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }
    res.json(player);
  } catch (err: unknown) {
    handleError(res, err, 'Failed to get player');
  }
});

/**
 * PUT /players/:id - Update player (partial). Sync Team.players when team changes.
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const player = await Player.findOne(idQuery(req.params.id)).exec();
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    const parsed = parsePlayerBody(req.body);
    const oldTeamId = player.team as mongoose.Types.ObjectId | null;

    let newTeamId: mongoose.Types.ObjectId | null = null;
    if (parsed.teamId !== undefined) {
      if (parsed.teamId) {
        newTeamId = await resolveTeamId(parsed.teamId);
        if (!newTeamId) {
          return res.status(404).json({ error: 'Team not found' });
        }
      }
    }

    // Update player fields
    Object.assign(player, {
      ...(parsed.firstName !== undefined && { firstName: parsed.firstName }),
      ...(parsed.lastName !== undefined && { lastName: parsed.lastName }),
      ...(parsed.position !== undefined && { position: parsed.position }),
      ...(parsed.dateOfBirth !== undefined && {
        dateOfBirth: parsed.dateOfBirth,
      }),
      ...(parsed.jerseyNumber !== undefined && {
        jerseyNumber: parsed.jerseyNumber,
      }),
      ...(parsed.height !== undefined && { height: parsed.height }),
      ...(parsed.teamId !== undefined && { team: newTeamId ?? undefined }),
    });

    await player.save();
    await syncTeamPlayers(player._id, oldTeamId, newTeamId);

    const populated = await populatePlayer(Player.findById(player._id));
    res.json(populated);
  } catch (err: unknown) {
    handleError(res, err, 'Failed to update player');
  }
});

/**
 * DELETE /players/:id - Remove from team's players (if any), then delete player.
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const player = await Player.findOne(idQuery(req.params.id)).exec();
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    if (player.team) {
      await Team.updateOne(
        { _id: player.team },
        { $pull: { players: player._id } }
      ).exec();
    }

    await Player.deleteOne({ _id: player._id }).exec();
    res.status(204).send();
  } catch (err: unknown) {
    handleError(res, err, 'Failed to delete player');
  }
});

export default router;
