import mongoose from 'mongoose';
import { HttpError } from '../lib/httpError';
import { idQuery } from '../lib/idQuery';
import { resolveId } from '../lib/resolveId';
import Player, { IPlayer } from '../models/Player';
import Team from '../models/Team';
import { populatePlayer, populatePlayers } from '../serializers/player';
import type { CreatePlayerInput, UpdatePlayerInput } from '../schemas/player';
import { isAdmin } from '../lib/authorization';
import { assertTeamOwner, ownedTeamIds } from './ownership';
import type { AuthUser } from '../types/auth';

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

const findAccessiblePlayer = async (id: string, auth: AuthUser) => {
  const player = await Player.findOne(idQuery(id)).exec();
  if (!player || !(await canAccessPlayer(player, auth))) {
    // 404 rather than 403 so ids owned by others are not discoverable.
    throw new HttpError(404, 'Player not found');
  }
  return player;
};

const resolveOwnedTeam = async (teamRef: string, auth: AuthUser) => {
  const teamId = await resolveId(Team, teamRef);
  if (!teamId) {
    throw new HttpError(404, 'Team not found');
  }
  await assertTeamOwner(teamId, auth);
  return teamId;
};

export const createPlayer = async (
  auth: AuthUser,
  input: CreatePlayerInput
) => {
  const { team: teamRef, ...fields } = input;
  const teamId = teamRef ? await resolveOwnedTeam(teamRef, auth) : null;

  const player = await Player.create({
    ...fields,
    team: teamId ?? undefined,
    createdBy: auth.id,
  });

  return populatePlayer(Player.findById(player._id));
};

export const listPlayers = async (
  auth: AuthUser,
  options: { teamRef?: string; limit: number; offset: number }
) => {
  let filter: mongoose.FilterQuery<IPlayer> = {};

  if (options.teamRef) {
    filter.team = await resolveOwnedTeam(options.teamRef, auth);
  } else if (!isAdmin(auth)) {
    filter = {
      $or: [
        { team: { $in: await ownedTeamIds(auth) } },
        { createdBy: auth.id },
      ],
    };
  }

  return populatePlayers(
    Player.find(filter).skip(options.offset).limit(options.limit)
  );
};

export const getPlayer = async (auth: AuthUser, id: string) => {
  const player = await findAccessiblePlayer(id, auth);
  return populatePlayer(Player.findById(player._id));
};

export const updatePlayer = async (
  auth: AuthUser,
  id: string,
  input: UpdatePlayerInput
) => {
  const player = await findAccessiblePlayer(id, auth);

  const { team: teamRef, ...fields } = input;
  const oldTeamId = player.team as mongoose.Types.ObjectId | null;
  const teamChanged = teamRef !== undefined;

  let newTeamId: mongoose.Types.ObjectId | null = null;
  if (teamChanged) {
    if (teamRef) {
      newTeamId = await resolveId(Team, teamRef);
      if (!newTeamId) {
        throw new HttpError(404, 'Team not found');
      }
    }
    // A transfer touches two rosters, so both must belong to the caller.
    if (oldTeamId) await assertTeamOwner(oldTeamId, auth);
    if (newTeamId) await assertTeamOwner(newTeamId, auth);
  }

  Object.assign(player, fields, {
    ...(teamChanged && { team: newTeamId ?? undefined }),
  });

  await player.save();

  return populatePlayer(Player.findById(player._id));
};

export const deletePlayer = async (auth: AuthUser, id: string) => {
  const player = await findAccessiblePlayer(id, auth);

  await Player.deleteOne({ _id: player._id }).exec();
};
