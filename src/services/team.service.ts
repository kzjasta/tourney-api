import mongoose from 'mongoose';
import Team from '../models/Team';

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
