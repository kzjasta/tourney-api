import mongoose from 'mongoose';
import type { IPlayer, PlayerPosition } from '../models/Player';

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
  query: mongoose.Query<unknown, unknown>
): Promise<PlayerView | null> =>
  (await query
    .populate('team', TEAM_FIELDS)
    .lean()) as unknown as PlayerView | null;

export const populatePlayers = async (
  query: mongoose.Query<unknown, unknown>
): Promise<PlayerView[]> =>
  (await query.populate('team', TEAM_FIELDS).lean()) as unknown as PlayerView[];

/** Populates a document already in hand, avoiding a refetch by id. */
export const serializePlayer = async (doc: IPlayer): Promise<PlayerView> =>
  (await doc.populate('team', TEAM_FIELDS)).toObject() as unknown as PlayerView;
