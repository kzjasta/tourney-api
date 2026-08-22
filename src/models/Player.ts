import mongoose, { Schema, Document, Model } from 'mongoose';
import { randomUUID } from 'crypto';

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
  },
  {
    timestamps: true,
  }
);

// Players on the same team cannot have the same jersey number (only when both are set)
playerSchema.index(
  { team: 1, jerseyNumber: 1 },
  {
    unique: true,
    partialFilterExpression: {
      team: { $exists: true, $ne: null },
      jerseyNumber: { $exists: true, $ne: null },
    },
  }
);

playerSchema.pre('save', async function (next) {
  if (this.team == null || this.jerseyNumber == null) return next();
  const Model = this.constructor as mongoose.Model<IPlayer>;
  const existing = await Model.findOne({
    team: this.team,
    jerseyNumber: this.jerseyNumber,
    _id: { $ne: this._id },
  });
  if (existing) {
    next(new Error('Jersey number already in use on this team'));
    return;
  }
  next();
});

const Player: Model<IPlayer> =
  mongoose.models.Player ?? mongoose.model<IPlayer>('Player', playerSchema);

export default Player;
