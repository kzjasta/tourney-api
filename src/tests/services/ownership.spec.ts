import { assertTeamOwner, ownedTeamIds } from '../../services/ownership';
import {
  authFor,
  clearTestDb,
  connectTestDb,
  createTeam,
  createUser,
  disconnectTestDb,
} from '../helpers/db';

beforeAll(connectTestDb, 60000);
afterAll(disconnectTestDb);
beforeEach(clearTestDb);

describe('assertTeamOwner', () => {
  it('resolves for the owner', async () => {
    const owner = await createUser();
    const team = await createTeam(owner._id);

    await expect(
      assertTeamOwner(team._id, authFor(owner))
    ).resolves.toBeUndefined();
  });

  it('throws 403 for a non-owner', async () => {
    const owner = await createUser();
    const other = await createUser();
    const team = await createTeam(owner._id);

    await expect(
      assertTeamOwner(team._id, authFor(other))
    ).rejects.toMatchObject({
      status: 403,
      message: 'You do not own this team',
    });
  });

  it('lets an admin bypass ownership', async () => {
    const owner = await createUser();
    const admin = await createUser({ role: 'admin' });
    const team = await createTeam(owner._id);

    await expect(
      assertTeamOwner(team._id, authFor(admin))
    ).resolves.toBeUndefined();
  });
});

describe('ownedTeamIds', () => {
  it('returns only the teams the user owns', async () => {
    const owner = await createUser();
    const other = await createUser();
    const mine = await createTeam(owner._id, 'Mine');
    await createTeam(other._id, 'Theirs');

    const ids = await ownedTeamIds(authFor(owner));

    expect(ids.map(String)).toEqual([mine._id.toString()]);
  });

  it('returns an empty list when the user owns none', async () => {
    const user = await createUser();

    await expect(ownedTeamIds(authFor(user))).resolves.toEqual([]);
  });
});
