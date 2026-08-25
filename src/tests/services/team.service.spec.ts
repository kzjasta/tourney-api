import Team from '../../models/Team';
import { addPlayerToTeam, syncTeamPlayers } from '../../services/team.service';
import {
  clearTestDb,
  connectTestDb,
  createPlayer,
  createTeam,
  createUser,
  disconnectTestDb,
} from '../helpers/db';

beforeAll(connectTestDb, 60000);
afterAll(disconnectTestDb);
beforeEach(clearTestDb);
afterEach(() => jest.restoreAllMocks());

const rosterOf = async (teamId: unknown) => {
  const team = await Team.findById(teamId).lean();
  return (team?.players ?? []).map(String);
};

describe('syncTeamPlayers', () => {
  it('makes no writes when the team has not changed', async () => {
    const user = await createUser();
    const team = await createTeam(user._id);
    const player = await createPlayer(user._id, team._id);
    const updateOne = jest.spyOn(Team, 'updateOne');

    await syncTeamPlayers(player._id, team._id, team._id);

    expect(updateOne).not.toHaveBeenCalled();
    expect(await rosterOf(team._id)).toEqual([player._id.toString()]);
  });

  it('moves the player between both rosters on a transfer', async () => {
    const user = await createUser();
    const from = await createTeam(user._id, 'From');
    const to = await createTeam(user._id, 'To');
    const player = await createPlayer(user._id, from._id);

    await syncTeamPlayers(player._id, from._id, to._id);

    expect(await rosterOf(from._id)).toEqual([]);
    expect(await rosterOf(to._id)).toEqual([player._id.toString()]);
  });

  it('removes the player when the new team is null', async () => {
    const user = await createUser();
    const team = await createTeam(user._id);
    const player = await createPlayer(user._id, team._id);

    await syncTeamPlayers(player._id, team._id, null);

    expect(await rosterOf(team._id)).toEqual([]);
  });

  it('adds the player when the old team is null', async () => {
    const user = await createUser();
    const team = await createTeam(user._id);
    const player = await createPlayer(user._id);

    await syncTeamPlayers(player._id, null, team._id);

    expect(await rosterOf(team._id)).toEqual([player._id.toString()]);
  });

  it('does nothing when both teams are null', async () => {
    const user = await createUser();
    const player = await createPlayer(user._id);
    const updateOne = jest.spyOn(Team, 'updateOne');

    await syncTeamPlayers(player._id, null, null);

    expect(updateOne).not.toHaveBeenCalled();
  });
});

describe('addPlayerToTeam', () => {
  it('does not duplicate a player already on the roster', async () => {
    const user = await createUser();
    const team = await createTeam(user._id);
    const player = await createPlayer(user._id, team._id);

    await addPlayerToTeam(team._id, player._id);

    expect(await rosterOf(team._id)).toEqual([player._id.toString()]);
  });
});
