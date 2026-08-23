import mongoose, { Schema, Document, Model } from 'mongoose';
import { randomUUID } from 'crypto';
import bcrypt from 'bcrypt';
import { config } from '../config/env';

export const USER_ROLES = ['admin', 'organizer', 'coach', 'player'] as const;

export type UserRole = (typeof USER_ROLES)[number];

export interface IUser extends Document {
  uuid: string;
  username: string;
  email: string;
  password: string;
  role: UserRole;
  tokenVersion: number;
  comparePassword(candidate: string): Promise<boolean>;
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
    password: {
      type: String,
      required: true,
      minlength: 8,
      select: false,
    },
    role: {
      type: String,
      enum: USER_ROLES,
      default: 'organizer',
    },
    // Bumped on logout to invalidate every outstanding refresh token.
    tokenVersion: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Collation strength 2 makes this case-insensitive, so "Coach" and "coach"
// cannot both be registered while the original casing is still displayed.
userSchema.index(
  { username: 1 },
  { unique: true, collation: { locale: 'en', strength: 2 } }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, config.bcryptRounds);
  next();
});

userSchema.methods.comparePassword = function (
  candidate: string
): Promise<boolean> {
  return bcrypt.compare(candidate, this.password);
};

const User: Model<IUser> =
  mongoose.models.User ?? mongoose.model<IUser>('User', userSchema);

export default User;
