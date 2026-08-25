import Team from '../../models/Team';
import {
  getPlayer,
  listPlayers,
  updatePlayer,
} from '../../services/player.service';
import {
  authFor,
  clearTestDb,
  connectTestDb,
  createPlayer as seedPlayer,
  createTeam,
  createUser,
  disconnectTestDb,
} from '../helpers/db';

beforeAll(connectTestDb, 60000);
afterAll(disconnectTestDb);
beforeEach(clearTestDb);

const page = { limit: 50, offset: 0 };

describe('player access rules', () => {
  it('grants access to the creator of an unattached player', async () => {
    const user = await createUser();
    const player = await seedPlayer(user._id);

    const found = await getPlayer(authFor(user), player.uuid);

    expect(found?.uuid).toBe(player.uuid);
  });

  it('grants access to the owner of the player\u2019s team', async () => {
    const owner = await createUser();
    const other = await createUser();
    const team = await createTeam(owner._id);
    // Created by someone else, so access can only come from team ownership.
    const player = await seedPlayer(other._id, team._id);

    const found = await getPlayer(authFor(owner), player.uuid);

    expect(found?.uuid).toBe(player.uuid);
  });

  it('grants access to an admin who neither created nor owns', async () => {
    const other = await createUser();
    const admin = await createUser({ role: 'admin' });
    const team = await createTeam(other._id);
    const player = await seedPlayer(other._id, team._id);

    const found = await getPlayer(authFor(admin), player.uuid);

    expect(found?.uuid).toBe(player.uuid);
  });

  it('hides a player the caller neither created nor rosters', async () => {
    const user = await createUser();
    const other = await createUser();
    const team = await createTeam(other._id);
    const player = await seedPlayer(other._id, team._id);

    await expect(getPlayer(authFor(user), player.uuid)).rejects.toMatchObject({
      status: 404,
      message: 'Player not found',
    });
  });
});

describe('listPlayers', () => {
  it('returns players on the caller\u2019s teams plus players they created', async () => {
    const user = await createUser();
    const other = await createUser();
    const myTeam = await createTeam(user._id, 'Mine');
    const theirTeam = await createTeam(other._id, 'Theirs');
    await seedPlayer(other._id, myTeam._id, { firstName: 'OnMyTeam' });
    await seedPlayer(user._id, undefined, { firstName: 'IMade' });
    await seedPlayer(other._id, theirTeam._id, { firstName: 'Theirs' });

    const players = await listPlayers(authFor(user), page);

    expect(players.map(p => p.firstName).sort()).toEqual(['IMade', 'OnMyTeam']);
  });

  it('returns every player for an admin', async () => {
    const admin = await createUser({ role: 'admin' });
    const other = await createUser();
    await seedPlayer(other._id);
    await seedPlayer(other._id);

    const players = await listPlayers(authFor(admin), page);

    expect(players).toHaveLength(2);
  });

  it('applies limit and offset', async () => {
    const user = await createUser();
    await seedPlayer(user._id);
    await seedPlayer(user._id);
    await seedPlayer(user._id);

    const firstPage = await listPlayers(authFor(user), { limit: 2, offset: 0 });
    const secondPage = await listPlayers(authFor(user), {
      limit: 2,
      offset: 2,
    });

    expect(firstPage).toHaveLength(2);
    expect(secondPage).toHaveLength(1);
  });
});

describe('updatePlayer', () => {
  it('keeps a rostered player on their team when other fields change', async () => {
    const user = await createUser();
    const team = await createTeam(user._id);
    const player = await seedPlayer(user._id, team._id);

    await updatePlayer(authFor(user), player.uuid, { firstName: 'Renamed' });

    const stored = await Team.findById(team._id).lean();
    expect((stored?.players ?? []).map(String)).toEqual([
      player._id.toString(),
    ]);
  });

  it('clears the team when team is null', async () => {
    const user = await createUser();
    const team = await createTeam(user._id);
    const player = await seedPlayer(user._id, team._id);

    const updated = await updatePlayer(authFor(user), player.uuid, {
      team: null,
    });

    expect(updated?.team).toBeFalsy();
    const stored = await Team.findById(team._id).lean();
    expect(stored?.players ?? []).toEqual([]);
  });
});
