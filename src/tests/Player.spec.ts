import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import User from '../models/User';
import Team from '../models/Team';
import Player from '../models/Player';

let memoryServer: MongoMemoryServer;

beforeAll(async () => {
  memoryServer = await MongoMemoryServer.create();
  await mongoose.connect(memoryServer.getUri());
}, 30000);

afterAll(async () => {
  await mongoose.disconnect();
  if (memoryServer) await memoryServer.stop();
});

beforeEach(async () => {
  await Player.deleteMany({});
  await Team.deleteMany({});
  await User.deleteMany({});
});

const createUser = async () => {
  return User.create({
    username: 'coach',
    email: 'coach@example.com',
    password: 'password123',
  });
};

const createTeam = async (createdBy: mongoose.Types.ObjectId) => {
  return Team.create({
    name: 'Warriors',
    createdBy,
  });
};

describe('Player model - jersey number uniqueness per team', () => {
  it('rejects when two players on the same team have the same jersey number', async () => {
    const user = await createUser();
    const team = await createTeam(user._id);

    await Player.create({
      firstName: 'Alice',
      lastName: 'Smith',
      team: team._id,
      jerseyNumber: 10,
      createdBy: user._id,
    });

    const secondPlayer = new Player({
      firstName: 'Bob',
      lastName: 'Jones',
      team: team._id,
      jerseyNumber: 10,
      createdBy: user._id,
    });

    await expect(secondPlayer.save()).rejects.toThrow(
      'Jersey number already in use on this team'
    );
  });

  it('allows two players on the same team with different jersey numbers', async () => {
    const user = await createUser();
    const team = await createTeam(user._id);

    const player1 = await Player.create({
      firstName: 'Alice',
      lastName: 'Smith',
      team: team._id,
      jerseyNumber: 10,
      createdBy: user._id,
    });

    const player2 = await Player.create({
      firstName: 'Bob',
      lastName: 'Jones',
      team: team._id,
      jerseyNumber: 11,
      createdBy: user._id,
    });

    expect(player1.jerseyNumber).toBe(10);
    expect(player2.jerseyNumber).toBe(11);
    expect(player1.team?.toString()).toBe(team._id.toString());
    expect(player2.team?.toString()).toBe(team._id.toString());
  });

  it('allows the same jersey number on different teams', async () => {
    const user = await createUser();
    const teamA = await createTeam(user._id);
    const teamB = await createTeam(user._id);

    const player1 = await Player.create({
      firstName: 'Alice',
      lastName: 'Smith',
      team: teamA._id,
      jerseyNumber: 10,
      createdBy: user._id,
    });

    const player2 = await Player.create({
      firstName: 'Bob',
      lastName: 'Jones',
      team: teamB._id,
      jerseyNumber: 10,
      createdBy: user._id,
    });

    expect(player1.jerseyNumber).toBe(10);
    expect(player2.jerseyNumber).toBe(10);
    expect(player1.team?.toString()).toBe(teamA._id.toString());
    expect(player2.team?.toString()).toBe(teamB._id.toString());
  });

  it('rejects exactly one of two concurrent inserts of the same number', async () => {
    const user = await createUser();
    const team = await createTeam(user._id);

    const results = await Promise.allSettled([
      Player.create({
        firstName: 'Alice',
        lastName: 'Smith',
        team: team._id,
        jerseyNumber: 9,
        createdBy: user._id,
      }),
      Player.create({
        firstName: 'Bob',
        lastName: 'Jones',
        team: team._id,
        jerseyNumber: 9,
        createdBy: user._id,
      }),
    ]);

    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find(
      r => r.status === 'rejected'
    ) as PromiseRejectedResult;
    expect(rejected.reason).toMatchObject({
      status: 409,
      message: 'Jersey number already in use on this team',
    });
    expect(await Player.countDocuments({ team: team._id })).toBe(1);
  });
});
