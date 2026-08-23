import mongoose from 'mongoose';
import { HttpError } from '../lib/httpError';
import { idQuery } from '../lib/idQuery';
import { resolveId } from '../lib/resolveId';
import Team from '../models/Team';
import Player from '../models/Player';
import User from '../models/User';
import { populateTeam } from '../serializers/team';
import type { CreateTeamInput, UpdateTeamInput } from '../schemas/team';
import { isAdmin } from '../lib/authorization';
import type { AuthUser } from '../types/express';

export const addPlayerToTeam = (
  teamId: mongoose.Types.ObjectId,
  playerId: mongoose.Types.ObjectId
) =>
  Team.updateOne({ _id: teamId }, { $addToSet: { players: playerId } }).exec();

export const removePlayerFromTeam = (
  teamId: mongoose.Types.ObjectId,
  playerId: mongoose.Types.ObjectId
) => Team.updateOne({ _id: teamId }, { $pull: { players: playerId } }).exec();

export const syncTeamPlayers = async (
  playerId: mongoose.Types.ObjectId,
  oldTeamId: mongoose.Types.ObjectId | null,
  newTeamId: mongoose.Types.ObjectId | null
) => {
  if (oldTeamId?.toString() === newTeamId?.toString()) return;
  if (oldTeamId) await removePlayerFromTeam(oldTeamId, playerId);
  if (newTeamId) await addPlayerToTeam(newTeamId, playerId);
};

const findOwnedTeam = async (id: string, auth: AuthUser) => {
  const team = await Team.findOne(idQuery(id)).exec();
  if (!team) {
    throw new HttpError(404, 'Team not found');
  }
  if (!isAdmin(auth) && !team.createdBy.equals(auth.id)) {
    throw new HttpError(403, 'You do not own this team');
  }
  return team;
};

export const createTeam = async (auth: AuthUser, input: CreateTeamInput) => {
  const team = await Team.create({
    name: input.name,
    coach: input.coach || undefined,
    createdBy: auth.id,
    players: [],
  });

  return populateTeam(Team.findById(team._id));
};

export const listTeams = async (auth: AuthUser, userRef?: string) => {
  let ownerId = auth.id;

  if (userRef) {
    if (!isAdmin(auth)) {
      throw new HttpError(403, "Only admins may list another user's teams");
    }
    const resolved = await resolveId(User, userRef);
    if (!resolved) {
      throw new HttpError(404, 'User not found');
    }
    ownerId = resolved;
  }

  return populateTeam(Team.find({ createdBy: ownerId }));
};

export const getTeam = async (auth: AuthUser, id: string) => {
  const filter = isAdmin(auth)
    ? idQuery(id)
    : { ...idQuery(id), createdBy: auth.id };

  const team = await populateTeam(Team.findOne(filter));
  if (!team) {
    throw new HttpError(404, 'Team not found');
  }
  return team;
};

export const updateTeam = async (
  auth: AuthUser,
  id: string,
  input: UpdateTeamInput
) => {
  const team = await findOwnedTeam(id, auth);

  if (input.name !== undefined) {
    team.name = input.name;
  }
  if (input.coach !== undefined) {
    team.coach = input.coach || undefined;
  }

  await team.save();
  return populateTeam(Team.findById(team._id));
};

export const deleteTeam = async (auth: AuthUser, id: string) => {
  const team = await findOwnedTeam(id, auth);

  await Player.updateMany({ team: team._id }, { $unset: { team: 1 } }).exec();
  await Team.deleteOne({ _id: team._id }).exec();
};
