import mongoose from 'mongoose';
import type { PlayerPosition } from '../models/Player';

const TEAM_FIELDS = 'uuid name coach';

// The lean + populate result does not match the document type, so the response
// shape is declared here.
export interface PlayerView {
  uuid: string;
  firstName: string;
  lastName: string;
  position?: PlayerPosition;
  dateOfBirth?: Date;
  jerseyNumber?: number;
  height?: string;
  team?: { uuid: string; name: string; coach?: string } | null;
}

export const populatePlayer = async (
  query: mongoose.Query<any, any>
): Promise<PlayerView | null> =>
  (await query
    .populate('team', TEAM_FIELDS)
    .lean()) as unknown as PlayerView | null;

export const populatePlayers = async (
  query: mongoose.Query<any, any>
): Promise<PlayerView[]> =>
  (await query.populate('team', TEAM_FIELDS).lean()) as unknown as PlayerView[];
