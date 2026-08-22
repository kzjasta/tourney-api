import mongoose, { Schema, Document, Model } from 'mongoose';
import { randomUUID } from 'crypto';

export interface ITeam extends Document {
  uuid: string;
  name: string;
  players: mongoose.Types.ObjectId[];
  coach?: string;
  createdBy: mongoose.Types.ObjectId;
}

const teamSchema = new Schema<ITeam>(
  {
    uuid: {
      type: String,
      required: true,
      unique: true,
      default: () => randomUUID(),
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    players: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Player',
      },
    ],
    coach: {
      type: String,
      trim: true,
      default: null,
    },
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

const Team: Model<ITeam> =
  mongoose.models.Team ?? mongoose.model<ITeam>('Team', teamSchema);

export default Team;
