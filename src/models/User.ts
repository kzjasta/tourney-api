import mongoose, { Schema, Document, Model } from 'mongoose';
import { randomUUID } from 'crypto';

export interface IUser extends Document {
  uuid: string;
  username: string;
  email: string;
}

const userSchema = new Schema<IUser>(
  {
    uuid: {
      type: String,
      required: true,
      unique: true,
      default: () => randomUUID(),
    },
    username: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
  },
  {
    timestamps: true,
  }
);

const User: Model<IUser> =
  mongoose.models.User ?? mongoose.model<IUser>('User', userSchema);

export default User;
