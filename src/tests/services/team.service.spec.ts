import Player from '../../models/Player';
import { deleteTeam, getTeam, listTeams } from '../../services/team.service';
import {
  authFor,
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

describe('team rosters', () => {
  it('derives the roster from Player.team', async () => {
    const user = await createUser();
    const team = await createTeam(user._id);
    await createPlayer(user._id, team._id, { firstName: 'Ana' });
    await createPlayer(user._id, team._id, { firstName: 'Bea' });
    await createPlayer(user._id, undefined, { firstName: 'Unattached' });

    const view = await getTeam(authFor(user), team.uuid);

    expect(view.players.map(p => p.firstName).sort()).toEqual(['Ana', 'Bea']);
  });

  it('returns an empty roster for a team with no players', async () => {
    const user = await createUser();
    const team = await createTeam(user._id);

    const view = await getTeam(authFor(user), team.uuid);

    expect(view.players).toEqual([]);
  });

  it('orders the roster by jersey number, unnumbered players last', async () => {
    const user = await createUser();
    const team = await createTeam(user._id);
    await createPlayer(user._id, team._id, {
      firstName: 'Ten',
      jerseyNumber: 10,
    });
    await createPlayer(user._id, team._id, { firstName: 'None' });
    await createPlayer(user._id, team._id, {
      firstName: 'Two',
      jerseyNumber: 2,
    });

    const view = await getTeam(authFor(user), team.uuid);

    expect(view.players.map(p => p.firstName)).toEqual(['Two', 'Ten', 'None']);
  });

  it('keeps rosters separate when listing several teams', async () => {
    const user = await createUser();
    const a = await createTeam(user._id, 'A');
    const b = await createTeam(user._id, 'B');
    await createPlayer(user._id, a._id, { firstName: 'InA' });
    await createPlayer(user._id, b._id, { firstName: 'InB' });

    const teams = await listTeams(authFor(user));

    const rosters = new Map(
      teams.map(t => [t.name, t.players.map(p => p.firstName)])
    );
    expect(rosters.get('A')).toEqual(['InA']);
    expect(rosters.get('B')).toEqual(['InB']);
  });

  it('reflects a transfer with no roster bookkeeping', async () => {
    const user = await createUser();
    const from = await createTeam(user._id, 'From');
    const to = await createTeam(user._id, 'To');
    const player = await createPlayer(user._id, from._id);

    await Player.updateOne({ _id: player._id }, { team: to._id });

    expect((await getTeam(authFor(user), from.uuid)).players).toEqual([]);
    expect((await getTeam(authFor(user), to.uuid)).players).toHaveLength(1);
  });
});

describe('deleteTeam', () => {
  it('detaches players rather than deleting them', async () => {
    const user = await createUser();
    const team = await createTeam(user._id);
    const player = await createPlayer(user._id, team._id);

    await deleteTeam(authFor(user), team.uuid);

    const stored = await Player.findById(player._id).lean();
    expect(stored).not.toBeNull();
    expect(stored?.team).toBeFalsy();
  });
});
