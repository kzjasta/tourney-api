import { Router, Request, Response } from 'express';
import Team from '../models/Team';
import Player from '../models/Player';
import { idQuery } from '../lib/idQuery';
import {
  handleGenericError,
  resolveUserId,
  populateTeam,
} from '../utils/utils';

const router = Router();

/**
 * POST /teams - Create a team (requires createdBy user id until auth is added)
 * Body: { name: string, coach?: string, createdBy: string } (createdBy = User uuid or _id)
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, coach, createdBy } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Team name is required' });
    }

    if (!createdBy) {
      return res.status(400).json({ error: 'createdBy (user id) is required' });
    }

    const userId = await resolveUserId(createdBy);
    if (!userId) {
      return res.status(404).json({ error: 'User not found' });
    }

    const team = await Team.create({
      name: name.trim(),
      coach: coach ? String(coach).trim() : undefined,
      createdBy: userId,
      players: [],
    });

    const populated = await populateTeam(Team.findById(team._id));
    res.status(201).json(populated);
  } catch (err) {
    handleGenericError(res, err, 'Failed to create team');
  }
});

/**
 * GET /teams?userId=... - List teams for a user
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'userId query is required' });
    }

    const userObjectId = await resolveUserId(String(userId));
    if (!userObjectId) {
      return res.status(404).json({ error: 'User not found' });
    }

    const teams = await populateTeam(Team.find({ createdBy: userObjectId }));
    res.json(teams);
  } catch (err) {
    handleGenericError(res, err, 'Failed to list teams');
  }
});

/**
 * GET /teams/:id - Get one team by id (uuid or ObjectId)
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const team = await populateTeam(Team.findOne(idQuery(req.params.id)));
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }
    res.json(team);
  } catch (err) {
    handleGenericError(res, err, 'Failed to get team');
  }
});

/**
 * PUT /teams/:id - Update team (partial: name?, coach?)
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const team = await Team.findOne(idQuery(req.params.id)).exec();
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    const { name, coach } = req.body;
    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        return res
          .status(400)
          .json({ error: 'Team name must be a non-empty string' });
      }
      team.name = name.trim();
    }
    if (coach !== undefined) {
      team.coach = coach ? String(coach).trim() : undefined;
    }

    await team.save();
    const populated = await populateTeam(Team.findById(team._id));
    res.json(populated);
  } catch (err) {
    handleGenericError(res, err, 'Failed to update team');
  }
});

/**
 * DELETE /teams/:id - Delete team and unset team on all players that referenced it
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const team = await Team.findOne(idQuery(req.params.id)).exec();
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    await Player.updateMany({ team: team._id }, { $unset: { team: 1 } }).exec();
    await Team.deleteOne({ _id: team._id }).exec();
    res.status(204).send();
  } catch (err) {
    handleGenericError(res, err, 'Failed to delete team');
  }
});

export default router;
