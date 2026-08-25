import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../models/User';
import Team from '../models/Team';
import Player from '../models/Player';

const DEV_SEED_PASSWORD = 'changeme123';

const seedPassword = () => {
  if (process.env.SEED_PASSWORD) return process.env.SEED_PASSWORD;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SEED_PASSWORD must be set when seeding in production');
  }
  console.warn(
    `[seed] SEED_PASSWORD not set - using the development default "${DEV_SEED_PASSWORD}".`
  );
  return DEV_SEED_PASSWORD;
};

const EXAMPLE_USER = {
  username: 'example',
  email: 'example@tourney.local',
  role: 'organizer' as const,
};

const TEAM_DATA = [
  { name: 'Warriors', coach: 'Coach Johnson' },
  { name: 'Titans', coach: 'Coach Smith' },
];

const PLAYER_DATA = [
  // Warriors (Team 1)
  {
    firstName: 'Alice',
    lastName: 'Johnson',
    position: 'Setter',
    jerseyNumber: 1,
  },
  {
    firstName: 'Bob',
    lastName: 'Williams',
    position: 'Outside Hitter',
    jerseyNumber: 2,
  },
  {
    firstName: 'Carol',
    lastName: 'Davis',
    position: 'Middle Blocker',
    jerseyNumber: 3,
  },
  {
    firstName: 'David',
    lastName: 'Miller',
    position: 'Opposite Hitter',
    jerseyNumber: 4,
  },
  { firstName: 'Eve', lastName: 'Wilson', position: 'Libero', jerseyNumber: 5 },
  {
    firstName: 'Frank',
    lastName: 'Brown',
    position: 'Outside Hitter',
    jerseyNumber: 6,
  },

  // Titans (Team 2)
  {
    firstName: 'Grace',
    lastName: 'Taylor',
    position: 'Setter',
    jerseyNumber: 1,
  },
  {
    firstName: 'Henry',
    lastName: 'Anderson',
    position: 'Outside Hitter',
    jerseyNumber: 2,
  },
  {
    firstName: 'Iris',
    lastName: 'Thomas',
    position: 'Middle Blocker',
    jerseyNumber: 3,
  },
  {
    firstName: 'Jack',
    lastName: 'Jackson',
    position: 'Opposite Hitter',
    jerseyNumber: 4,
  },
  { firstName: 'Kate', lastName: 'White', position: 'Libero', jerseyNumber: 5 },
  {
    firstName: 'Leo',
    lastName: 'Harris',
    position: 'Outside Hitter',
    jerseyNumber: 6,
  },
];

const seed = async () => {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is not set in .env');
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected');

    // Clean up existing data
    await Player.deleteMany({});
    await Team.deleteMany({});
    await User.deleteMany({
      $or: [{ email: EXAMPLE_USER.email }, { username: EXAMPLE_USER.username }],
    });

    // Create user
    const user = await User.create({
      ...EXAMPLE_USER,
      password: seedPassword(),
    });
    console.log('Example user created:', {
      uuid: user.uuid,
      username: user.username,
      email: user.email,
    });

    // Create teams
    const teams = [];
    for (const teamData of TEAM_DATA) {
      const team = await Team.create({
        name: teamData.name,
        coach: teamData.coach,
        createdBy: user._id,
        players: [],
      });
      teams.push(team);
      console.log(`Team "${team.name}" created with ID: ${team.uuid}`);
    }

    // Create players for each team
    for (let teamIndex = 0; teamIndex < teams.length; teamIndex++) {
      const team = teams[teamIndex];
      const teamPlayers = [];

      for (let playerIndex = 0; playerIndex < 6; playerIndex++) {
        const playerDataIndex = teamIndex * 6 + playerIndex;
        const playerData = PLAYER_DATA[playerDataIndex];

        const player = await Player.create({
          ...playerData,
          team: team._id,
          createdBy: user._id,
        });

        teamPlayers.push(player._id);
        console.log(
          `Player "${player.firstName} ${player.lastName}" created for team "${team.name}"`
        );
      }

      // Update team with player references
      team.players = teamPlayers;
      await team.save();
    }

    console.log('Seed completed successfully!');
    console.log(
      `Created 1 user, ${teams.length} teams, and ${PLAYER_DATA.length} players`
    );
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    process.exit(0);
  }
};

seed();
