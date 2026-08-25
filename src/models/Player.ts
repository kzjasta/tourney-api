import mongoose, { Schema, Document, Model } from 'mongoose';
import { randomUUID } from 'crypto';
import { HttpError } from '../lib/httpError';

export const PLAYER_POSITIONS = [
  'Setter',
  'Outside Hitter',
  'Opposite Hitter',
  'Middle Blocker',
  'Libero',
] as const;

export type PlayerPosition = (typeof PLAYER_POSITIONS)[number];

export interface IPlayer extends Document {
  uuid: string;
  firstName: string;
  lastName: string;
  position?: PlayerPosition;
  dateOfBirth?: Date;
  jerseyNumber?: number;
  height?: string;
  team?: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
}

const playerSchema = new Schema<IPlayer>(
  {
    uuid: {
      type: String,
      required: true,
      unique: true,
      default: () => randomUUID(),
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    position: {
      type: String,
      trim: true,
      enum: PLAYER_POSITIONS,
    },
    dateOfBirth: {
      type: Date,
    },
    jerseyNumber: {
      type: Number,
    },
    height: {
      type: String,
      trim: true,
    },
    team: {
      type: Schema.Types.ObjectId,
      ref: 'Team',
      default: null,
    },
    // Owner of record, so players outlive the deletion of their team.
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Players on the same team cannot share a jersey number. $type (not $ne) is used
// because partial indexes reject $ne; it also excludes null/missing values.
playerSchema.index(
  { team: 1, jerseyNumber: 1 },
  {
    unique: true,
    partialFilterExpression: {
      team: { $type: 'objectId' },
      jerseyNumber: { $type: 'number' },
    },
  }
);

const isDuplicateJersey = (err: unknown): boolean => {
  if (!err || typeof err !== 'object') return false;
  if ((err as { code?: number }).code !== 11000) return false;
  const pattern = (err as { keyPattern?: Record<string, unknown> }).keyPattern;
  return !!pattern && 'team' in pattern && 'jerseyNumber' in pattern;
};

// The unique index above is the only guard; this maps its driver error to a 409.
playerSchema.post(
  'save',
  function (err: Error, _doc: IPlayer, next: (err?: Error) => void) {
    if (isDuplicateJersey(err)) {
      return next(
        new HttpError(409, 'Jersey number already in use on this team')
      );
    }
    next(err);
  }
);

const Player: Model<IPlayer> =
  mongoose.models.Player ?? mongoose.model<IPlayer>('Player', playerSchema);

export default Player;
