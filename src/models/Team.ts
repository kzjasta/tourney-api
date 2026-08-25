import mongoose, { Schema, Document, Model } from 'mongoose';
import { randomUUID } from 'crypto';

export interface ITeam extends Document {
  uuid: string;
  name: string;
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
