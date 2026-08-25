import mongoose from 'mongoose';
import { HttpError } from '../lib/httpError';
import { idQuery } from '../lib/idQuery';
import User from '../models/User';
import Team from '../models/Team';
import type { UpdateUserInput } from '../schemas/user';
import { assertSelfOrAdmin } from '../lib/authorization';
import type { AuthUser } from '../types/auth';

const PUBLIC_FIELDS = 'uuid username email role';

export const listUsers = (options: { limit: number; offset: number }) =>
  User.find()
    .select(PUBLIC_FIELDS)
    .skip(options.offset)
    .limit(options.limit)
    .lean();

export const getUser = async (auth: AuthUser, id: string) => {
  const user = await User.findOne(idQuery(id)).select(PUBLIC_FIELDS).lean();
  if (!user) {
    throw new HttpError(404, 'User not found');
  }
  assertSelfOrAdmin(user._id as mongoose.Types.ObjectId, auth);
  return user;
};

const findUserForCaller = async (id: string, auth: AuthUser) => {
  const user = await User.findOne(idQuery(id)).exec();
  if (!user) {
    throw new HttpError(404, 'User not found');
  }
  assertSelfOrAdmin(user._id as mongoose.Types.ObjectId, auth);
  return user;
};

export const updateUser = async (
  auth: AuthUser,
  id: string,
  input: UpdateUserInput
) => {
  const user = await findUserForCaller(id, auth);

  if (input.username !== undefined) {
    user.username = input.username;
  }
  if (input.email !== undefined) {
    user.email = input.email;
  }

  await user.save();
  return user;
};

export const deleteUser = async (auth: AuthUser, id: string) => {
  const user = await findUserForCaller(id, auth);

  const teamCount = await Team.countDocuments({ createdBy: user._id }).exec();
  if (teamCount > 0) {
    throw new HttpError(409, 'Cannot delete user that owns teams');
  }

  await User.deleteOne({ _id: user._id }).exec();
};
