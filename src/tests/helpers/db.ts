import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import User, { UserRole } from '../../models/User';
import Team from '../../models/Team';
import Player from '../../models/Player';
import { signAccessToken } from '../../lib/tokens';
import type { AuthUser } from '../../types/auth';

let memoryServer: MongoMemoryServer;

export const connectTestDb = async () => {
  memoryServer = await MongoMemoryServer.create();
  await mongoose.connect(memoryServer.getUri());
  // Unique indexes are built lazily, so wait for them before any test runs.
  await Promise.all([
    User.syncIndexes(),
    Team.syncIndexes(),
    Player.syncIndexes(),
  ]);
};

export const disconnectTestDb = async () => {
  await mongoose.disconnect();
  if (memoryServer) await memoryServer.stop();
};

export const clearTestDb = async () => {
  await Promise.all(
    Object.values(mongoose.connection.collections).map(collection =>
      collection.deleteMany({})
    )
  );
};

let userCounter = 0;

export const createUser = async (
  overrides: Partial<{
    username: string;
    email: string;
    password: string;
    role: UserRole;
  }> = {}
) => {
  userCounter += 1;
  return User.create({
    username: overrides.username ?? `user${userCounter}`,
    email: overrides.email ?? `user${userCounter}@example.com`,
    password: overrides.password ?? 'password123',
    role: overrides.role ?? 'organizer',
  });
};

export const createTeam = (
  createdBy: mongoose.Types.ObjectId,
  name = 'Warriors'
) => Team.create({ name, createdBy, players: [] });

export const createPlayer = async (
  createdBy: mongoose.Types.ObjectId,
  team?: mongoose.Types.ObjectId,
  overrides: Record<string, unknown> = {}
) => {
  const player = await Player.create({
    firstName: 'Jane',
    lastName: 'Doe',
    team: team ?? null,
    createdBy,
    ...overrides,
  });
  if (team) {
    await Team.updateOne({ _id: team }, { $addToSet: { players: player._id } });
  }
  return player;
};

/** Authorization header for a persisted user document. */
export const tokenFor = (user: {
  _id: unknown;
  role: UserRole;
  tokenVersion?: number;
}): string =>
  `Bearer ${signAccessToken({
    _id: user._id,
    role: user.role,
    tokenVersion: user.tokenVersion ?? 0,
  })}`;

/** AuthUser for a persisted user document, for calling services directly. */
export const authFor = (user: { _id: unknown; role: UserRole }): AuthUser => ({
  id: user._id as mongoose.Types.ObjectId,
  role: user.role,
});
