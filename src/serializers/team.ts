import mongoose from 'mongoose';
import type { PlayerPosition } from '../models/Player';

const PLAYER_FIELDS =
  'uuid firstName lastName position dateOfBirth jerseyNumber height';
const OWNER_FIELDS = 'uuid username email';

// The lean + populate result does not match the document type, so the response
// shape is declared here.
export interface TeamPlayerView {
  uuid: string;
  firstName: string;
  lastName: string;
  position?: PlayerPosition;
  dateOfBirth?: Date;
  jerseyNumber?: number;
  height?: string;
}

export interface TeamView {
  uuid: string;
  name: string;
  coach?: string | null;
  players: TeamPlayerView[];
  createdBy: { uuid: string; username: string; email: string };
}

const withRelations = (query: mongoose.Query<unknown, unknown>) =>
  query
    .populate('players', PLAYER_FIELDS)
    .populate('createdBy', OWNER_FIELDS)
    .lean();

export const populateTeam = async (
  query: mongoose.Query<unknown, unknown>
): Promise<TeamView | null> =>
  (await withRelations(query)) as unknown as TeamView | null;

export const populateTeams = async (
  query: mongoose.Query<unknown, unknown>
): Promise<TeamView[]> => (await withRelations(query)) as unknown as TeamView[];
