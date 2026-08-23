import mongoose from 'mongoose';
import { PLAYER_POSITIONS, type PlayerPosition } from '../models/Player';
import Team from '../models/Team';

const DEFAULT_LIMIT = 50;

export const resolveTeamId = async (
  teamId: string
): Promise<mongoose.Types.ObjectId | null> => {
  const byId =
    mongoose.Types.ObjectId.isValid(teamId) && String(teamId).length === 24;
  const team = await (
    byId ? Team.findById(teamId) : Team.findOne({ uuid: teamId })
  )
    .select('_id')
    .lean();
  return team ? (team._id as mongoose.Types.ObjectId) : null;
};

export const parsePlayerBody = (body: Record<string, unknown>) => {
  const {
    firstName,
    lastName,
    position,
    dateOfBirth,
    jerseyNumber,
    height,
    team: teamId,
  } = body;

  const parseString = (value: unknown) =>
    typeof value === 'string' ? value.trim() : undefined;

  const parseDate = (value: unknown) => {
    const d =
      value instanceof Date
        ? value
        : typeof value === 'string'
          ? new Date(value)
          : undefined;
    return d && !Number.isNaN(d.getTime()) ? d : undefined;
  };

  const parseInteger = (value: unknown) =>
    typeof value === 'number' && Number.isInteger(value) ? value : undefined;

  const parsePosition = (value: unknown) =>
    typeof value === 'string' &&
    PLAYER_POSITIONS.includes(value as PlayerPosition)
      ? (value as PlayerPosition)
      : undefined;

  return {
    ...(firstName !== undefined && { firstName: parseString(firstName) }),
    ...(lastName !== undefined && { lastName: parseString(lastName) }),
    ...(position !== undefined && { position: parsePosition(position) }),
    ...(dateOfBirth !== undefined && { dateOfBirth: parseDate(dateOfBirth) }),
    ...(jerseyNumber !== undefined && {
      jerseyNumber: parseInteger(jerseyNumber),
    }),
    ...(height !== undefined && { height: parseString(height) }),
    ...(teamId !== undefined && { teamId }),
  } as {
    firstName?: string;
    lastName?: string;
    position?: PlayerPosition;
    dateOfBirth?: Date;
    jerseyNumber?: number;
    height?: string;
    teamId?: string;
  };
};

export const parseQueryParams = (query: Record<string, unknown>) => {
  const limit = Math.min(
    Math.max(
      1,
      parseInt(String(query.limit || DEFAULT_LIMIT), 10) || DEFAULT_LIMIT
    ),
    100
  );
  const offset = Math.max(0, parseInt(String(query.offset || 0), 10) || 0);
  return { limit, offset };
};

export const populatePlayer = (query: mongoose.Query<any, any>) =>
  query.populate('team', 'uuid name coach').lean();

export const syncTeamPlayers = async (
  playerId: mongoose.Types.ObjectId,
  oldTeamId: mongoose.Types.ObjectId | null,
  newTeamId: mongoose.Types.ObjectId | null
) => {
  if (oldTeamId?.toString() === newTeamId?.toString()) return;

  if (oldTeamId) {
    await Team.updateOne(
      { _id: oldTeamId },
      { $pull: { players: playerId } }
    ).exec();
  }
  if (newTeamId) {
    await Team.updateOne(
      { _id: newTeamId },
      { $addToSet: { players: playerId } }
    ).exec();
  }
};

export const resolveUserId = async (
  userId: string
): Promise<mongoose.Types.ObjectId | null> => {
  const byId =
    mongoose.Types.ObjectId.isValid(userId) && String(userId).length === 24;
  const User = (await import('../models/User')).default;
  const user = await User.findOne(
    byId ? { _id: new mongoose.Types.ObjectId(userId) } : { uuid: userId }
  ).exec();
  return user ? user._id : null;
};

export const populateTeam = (query: mongoose.Query<any, any>) =>
  query
    .populate(
      'players',
      'uuid firstName lastName position dateOfBirth jerseyNumber height'
    )
    .populate('createdBy', 'uuid username email')
    .lean();
