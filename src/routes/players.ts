import { Router, Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import Player, { IPlayer } from '../models/Player';
import Team from '../models/Team';
import { idQuery } from '../lib/idQuery';
import { HttpError } from '../lib/httpError';
import { resolveId } from '../lib/resolveId';
import { parsePagination } from '../lib/pagination';
import { parsePlayerBody } from '../schemas/player';
import { populatePlayer } from '../serializers/player';
import {
  addPlayerToTeam,
  removePlayerFromTeam,
  syncTeamPlayers,
} from '../services/team.service';
import { currentUser, isAdmin } from '../middleware/auth';
import { assertTeamOwner, ownedTeamIds } from '../middleware/ownership';
import type { AuthUser } from '../types/express';

const router = Router();

/** Access is granted to the player's creator, to the owner of its team, or to admins. */
const canAccessPlayer = async (
  player: IPlayer,
  auth: AuthUser
): Promise<boolean> => {
  if (isAdmin(auth)) return true;
  if (player.createdBy?.equals(auth.id)) return true;
  if (!player.team) return false;
  const team = await Team.findOne({ _id: player.team, createdBy: auth.id })
    .select('_id')
    .lean();
  return !!team;
};

/**
 * POST /players - Create a player
 * Body: { firstName, lastName (required); position?, dateOfBirth?, jerseyNumber?, height?, team? }
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const auth = currentUser(req);
    const { firstName, lastName, ...rest } = parsePlayerBody(req.body);
    if (!firstName || !lastName) {
      throw new HttpError(400, 'First name and last name are required');
    }

    let teamObjectId: mongoose.Types.ObjectId | null = null;
    if (rest.teamId) {
      teamObjectId = await resolveId(Team, String(rest.teamId));
      if (!teamObjectId) {
        throw new HttpError(404, 'Team not found');
      }
      await assertTeamOwner(teamObjectId, auth);
    }

    const player = await Player.create({
      firstName,
      lastName,
      ...rest,
      team: teamObjectId ?? undefined,
      createdBy: auth.id,
    });

    if (teamObjectId) {
      await addPlayerToTeam(teamObjectId, player._id);
    }

    const populated = await populatePlayer(Player.findById(player._id));
    res.status(201).json(populated);
  } catch (err: unknown) {
    next(err);
  }
});

/**
 * GET /players - List players (optional ?teamId=, ?limit=, ?offset=)
 * Without ?teamId= this returns players on the caller's teams plus any they created.
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const auth = currentUser(req);
    const { teamId } = req.query;
    const { limit, offset } = parsePagination(req.query);
    let filter: mongoose.FilterQuery<unknown> = {};

    if (teamId && teamId !== '') {
      const tid = await resolveId(Team, String(teamId));
      if (!tid) {
        throw new HttpError(404, 'Team not found');
      }
      await assertTeamOwner(tid, auth);
      filter.team = tid;
    } else if (!isAdmin(auth)) {
      filter = {
        $or: [
          { team: { $in: await ownedTeamIds(auth) } },
          { createdBy: auth.id },
        ],
      };
    }

    const players = await populatePlayer(
      Player.find(filter).skip(offset).limit(limit)
    );
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
    const auth = currentUser(req);
    const player = await Player.findOne(idQuery(req.params.id)).exec();
    if (!player || !(await canAccessPlayer(player, auth))) {
      // 404 rather than 403 so ids owned by others are not discoverable.
      throw new HttpError(404, 'Player not found');
    }

    const populated = await populatePlayer(Player.findById(player._id));
    res.json(populated);
  } catch (err: unknown) {
    next(err);
  }
});

/**
 * PUT /players/:id - Update player (partial). Sync Team.players when team changes.
 */
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const auth = currentUser(req);
    const player = await Player.findOne(idQuery(req.params.id)).exec();
    if (!player || !(await canAccessPlayer(player, auth))) {
      throw new HttpError(404, 'Player not found');
    }

    const parsed = parsePlayerBody(req.body);
    const oldTeamId = player.team as mongoose.Types.ObjectId | null;

    let newTeamId: mongoose.Types.ObjectId | null = null;
    if (parsed.teamId !== undefined) {
      if (parsed.teamId) {
        newTeamId = await resolveId(Team, parsed.teamId);
        if (!newTeamId) {
          throw new HttpError(404, 'Team not found');
        }
      }
      // A transfer touches two rosters, so both must belong to the caller.
      if (oldTeamId) await assertTeamOwner(oldTeamId, auth);
      if (newTeamId) await assertTeamOwner(newTeamId, auth);
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
    next(err);
  }
});

/**
 * DELETE /players/:id - Remove from team's players (if any), then delete player.
 */
router.delete(
  '/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const auth = currentUser(req);
      const player = await Player.findOne(idQuery(req.params.id)).exec();
      if (!player || !(await canAccessPlayer(player, auth))) {
        throw new HttpError(404, 'Player not found');
      }

      if (player.team) {
        await removePlayerFromTeam(player.team, player._id);
      }

      await Player.deleteOne({ _id: player._id }).exec();
      res.status(204).send();
    } catch (err: unknown) {
      next(err);
    }
  }
);

export default router;
