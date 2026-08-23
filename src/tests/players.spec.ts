import request from 'supertest';
import { app } from '../app';
import Team from '../models/Team';
import Player from '../models/Player';
import {
  clearTestDb,
  connectTestDb,
  createPlayer,
  createTeam,
  createUser,
  disconnectTestDb,
  tokenFor,
} from './helpers/db';

beforeAll(connectTestDb, 60000);
afterAll(disconnectTestDb);
beforeEach(clearTestDb);

describe('Players routes', () => {
  it('returns 401 without a token', async () => {
    const res = await request(app).get('/players');

    expect(res.status).toBe(401);
  });

  describe('POST /players', () => {
    it('creates an unattached player owned by the caller', async () => {
      const user = await createUser();

      const res = await request(app)
        .post('/players')
        .set('Authorization', tokenFor(user))
        .send({ firstName: 'Jane', lastName: 'Doe' });

      expect(res.status).toBe(201);
      expect(res.body.firstName).toBe('Jane');

      const stored = await Player.findOne({ firstName: 'Jane' }).lean();
      expect(stored?.createdBy.toString()).toBe(user._id.toString());
    });

    it('attaches the player to an owned team and updates the roster', async () => {
      const user = await createUser();
      const team = await createTeam(user._id);

      const res = await request(app)
        .post('/players')
        .set('Authorization', tokenFor(user))
        .send({ firstName: 'Jane', lastName: 'Doe', team: team.uuid });

      expect(res.status).toBe(201);
      expect(res.body.team.uuid).toBe(team.uuid);

      const updatedTeam = await Team.findById(team._id).lean();
      expect(updatedTeam?.players).toHaveLength(1);
    });

    it('returns 403 when attaching to a team owned by someone else', async () => {
      const user = await createUser();
      const other = await createUser();
      const team = await createTeam(other._id);

      const res = await request(app)
        .post('/players')
        .set('Authorization', tokenFor(user))
        .send({ firstName: 'Jane', lastName: 'Doe', team: team.uuid });

      expect(res.status).toBe(403);
      expect(await Player.countDocuments()).toBe(0);
    });

    it('returns 404 when the team does not exist', async () => {
      const user = await createUser();

      const res = await request(app)
        .post('/players')
        .set('Authorization', tokenFor(user))
        .send({ firstName: 'Jane', lastName: 'Doe', team: 'no-such-team' });

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Team not found' });
    });

    it('returns 400 when a name is missing', async () => {
      const user = await createUser();

      const res = await request(app)
        .post('/players')
        .set('Authorization', tokenFor(user))
        .send({ lastName: 'Doe' });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        error: 'First name and last name are required',
      });
    });

    it('returns 409 for a duplicate jersey number on the same team', async () => {
      const user = await createUser();
      const team = await createTeam(user._id);
      await createPlayer(user._id, team._id, { jerseyNumber: 7 });

      const res = await request(app)
        .post('/players')
        .set('Authorization', tokenFor(user))
        .send({
          firstName: 'Other',
          lastName: 'Player',
          team: team.uuid,
          jerseyNumber: 7,
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('Jersey number');
    });
  });

  describe('GET /players', () => {
    it('returns players on the caller\u2019s teams and players they created', async () => {
      const user = await createUser();
      const other = await createUser();
      const myTeam = await createTeam(user._id, 'Mine');
      const theirTeam = await createTeam(other._id, 'Theirs');

      await createPlayer(user._id, myTeam._id, { firstName: 'Mine' });
      await createPlayer(user._id, undefined, { firstName: 'Unattached' });
      await createPlayer(other._id, theirTeam._id, { firstName: 'Theirs' });

      const res = await request(app)
        .get('/players')
        .set('Authorization', tokenFor(user));

      expect(res.status).toBe(200);
      const names = res.body.map((p: { firstName: string }) => p.firstName);
      expect(names).toHaveLength(2);
      expect(names).toEqual(expect.arrayContaining(['Mine', 'Unattached']));
      expect(names).not.toContain('Theirs');
    });

    it('filters by an owned teamId', async () => {
      const user = await createUser();
      const teamA = await createTeam(user._id, 'A');
      const teamB = await createTeam(user._id, 'B');
      await createPlayer(user._id, teamA._id, { firstName: 'InA' });
      await createPlayer(user._id, teamB._id, { firstName: 'InB' });

      const res = await request(app)
        .get('/players')
        .query({ teamId: teamA.uuid })
        .set('Authorization', tokenFor(user));

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].firstName).toBe('InA');
    });

    it('returns 403 when filtering by a team owned by someone else', async () => {
      const user = await createUser();
      const other = await createUser();
      const team = await createTeam(other._id);

      const res = await request(app)
        .get('/players')
        .query({ teamId: team.uuid })
        .set('Authorization', tokenFor(user));

      expect(res.status).toBe(403);
    });

    it('respects limit and offset', async () => {
      const user = await createUser();
      const team = await createTeam(user._id);
      await createPlayer(user._id, team._id, {
        firstName: 'One',
        jerseyNumber: 1,
      });
      await createPlayer(user._id, team._id, {
        firstName: 'Two',
        jerseyNumber: 2,
      });

      const res = await request(app)
        .get('/players')
        .query({ limit: 1, offset: 1 })
        .set('Authorization', tokenFor(user));

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });
  });

  describe('GET /players/:id', () => {
    it('returns an accessible player', async () => {
      const user = await createUser();
      const team = await createTeam(user._id);
      const player = await createPlayer(user._id, team._id);

      const res = await request(app)
        .get(`/players/${player.uuid}`)
        .set('Authorization', tokenFor(user));

      expect(res.status).toBe(200);
      expect(res.body.uuid).toBe(player.uuid);
      expect(res.body.team.uuid).toBe(team.uuid);
    });

    it('returns 404 rather than 403 for another user\u2019s player', async () => {
      const user = await createUser();
      const other = await createUser();
      const team = await createTeam(other._id);
      const player = await createPlayer(other._id, team._id);

      const res = await request(app)
        .get(`/players/${player.uuid}`)
        .set('Authorization', tokenFor(user));

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Player not found' });
    });
  });

  describe('PUT /players/:id', () => {
    it('updates simple fields', async () => {
      const user = await createUser();
      const player = await createPlayer(user._id);

      const res = await request(app)
        .put(`/players/${player.uuid}`)
        .set('Authorization', tokenFor(user))
        .send({ firstName: 'Updated', position: 'Libero' });

      expect(res.status).toBe(200);
      expect(res.body.firstName).toBe('Updated');
      expect(res.body.position).toBe('Libero');
    });

    it('transfers a player between two owned teams and syncs both rosters', async () => {
      const user = await createUser();
      const from = await createTeam(user._id, 'From');
      const to = await createTeam(user._id, 'To');
      const player = await createPlayer(user._id, from._id);

      const res = await request(app)
        .put(`/players/${player.uuid}`)
        .set('Authorization', tokenFor(user))
        .send({ team: to.uuid });

      expect(res.status).toBe(200);
      expect(res.body.team.uuid).toBe(to.uuid);

      const fromTeam = await Team.findById(from._id).lean();
      const toTeam = await Team.findById(to._id).lean();
      expect(fromTeam?.players).toHaveLength(0);
      expect(toTeam?.players).toHaveLength(1);
    });

    it('returns 403 when transferring to a team owned by someone else', async () => {
      const user = await createUser();
      const other = await createUser();
      const from = await createTeam(user._id, 'From');
      const to = await createTeam(other._id, 'To');
      const player = await createPlayer(user._id, from._id);

      const res = await request(app)
        .put(`/players/${player.uuid}`)
        .set('Authorization', tokenFor(user))
        .send({ team: to.uuid });

      expect(res.status).toBe(403);

      const unchanged = await Player.findById(player._id).lean();
      expect(unchanged?.team?.toString()).toBe(from._id.toString());
    });

    it('returns 404 for another user\u2019s player', async () => {
      const user = await createUser();
      const other = await createUser();
      const player = await createPlayer(other._id);

      const res = await request(app)
        .put(`/players/${player.uuid}`)
        .set('Authorization', tokenFor(user))
        .send({ firstName: 'Hijacked' });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /players/:id', () => {
    it('deletes an accessible player and pulls them from the roster', async () => {
      const user = await createUser();
      const team = await createTeam(user._id);
      const player = await createPlayer(user._id, team._id);

      const res = await request(app)
        .delete(`/players/${player.uuid}`)
        .set('Authorization', tokenFor(user));

      expect(res.status).toBe(204);
      expect(await Player.findById(player._id).lean()).toBeNull();

      const team_ = await Team.findById(team._id).lean();
      expect(team_?.players).toHaveLength(0);
    });

    it('returns 404 for another user\u2019s player', async () => {
      const user = await createUser();
      const other = await createUser();
      const player = await createPlayer(other._id);

      const res = await request(app)
        .delete(`/players/${player.uuid}`)
        .set('Authorization', tokenFor(user));

      expect(res.status).toBe(404);
      expect(await Player.findById(player._id).lean()).not.toBeNull();
    });
  });
});
