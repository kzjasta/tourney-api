import mongoose from 'mongoose';
import { HttpError } from '../lib/httpError';
import Team from '../models/Team';
import { isAdmin } from '../lib/authorization';
import type { AuthUser } from '../types/auth';

/** Throws 403 unless the user owns the team (admins bypass). */
export const assertTeamOwner = async (
  teamId: mongoose.Types.ObjectId,
  user: AuthUser
): Promise<void> => {
  if (isAdmin(user)) return;
  const team = await Team.findOne({ _id: teamId, createdBy: user.id })
    .select('_id')
    .lean();
  if (!team) {
    throw new HttpError(403, 'You do not own this team');
  }
};

/** Team ObjectIds the user owns, used to scope list queries. */
export const ownedTeamIds = async (
  user: AuthUser
): Promise<mongoose.Types.ObjectId[]> => {
  const teams = await Team.find({ createdBy: user.id }).select('_id').lean();
  return teams.map(team => team._id as mongoose.Types.ObjectId);
};
