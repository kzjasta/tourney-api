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

describe('Teams routes', () => {
  it('returns 401 without a token', async () => {
    const res = await request(app).get('/teams');

    expect(res.status).toBe(401);
  });

  describe('POST /teams', () => {
    it('creates a team owned by the authenticated user', async () => {
      const user = await createUser();

      const res = await request(app)
        .post('/teams')
        .set('Authorization', tokenFor(user))
        .send({ name: 'Warriors', coach: 'Coach Smith' });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Warriors');
      expect(res.body.coach).toBe('Coach Smith');
      expect(res.body.createdBy.uuid).toBe(user.uuid);
    });

    it('ignores a createdBy supplied in the body', async () => {
      const owner = await createUser();
      const victim = await createUser();

      const res = await request(app)
        .post('/teams')
        .set('Authorization', tokenFor(owner))
        .send({ name: 'Warriors', createdBy: victim._id.toString() });

      expect(res.status).toBe(201);
      expect(res.body.createdBy.uuid).toBe(owner.uuid);

      const stored = await Team.findOne({ name: 'Warriors' }).lean();
      expect(stored?.createdBy.toString()).toBe(owner._id.toString());
    });

    it('returns 400 when the name is missing', async () => {
      const user = await createUser();

      const res = await request(app)
        .post('/teams')
        .set('Authorization', tokenFor(user))
        .send({ coach: 'Coach Smith' });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Team name is required' });
    });
  });

  describe('GET /teams', () => {
    it('lists only the caller\u2019s teams', async () => {
      const owner = await createUser();
      const other = await createUser();
      await createTeam(owner._id, 'Mine');
      await createTeam(other._id, 'Theirs');

      const res = await request(app)
        .get('/teams')
        .set('Authorization', tokenFor(owner));

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toBe('Mine');
    });

    it('forbids a non-admin from listing another user\u2019s teams', async () => {
      const owner = await createUser();
      const other = await createUser();

      const res = await request(app)
        .get('/teams')
        .query({ userId: other.uuid })
        .set('Authorization', tokenFor(owner));

      expect(res.status).toBe(403);
    });

    it('allows an admin to list another user\u2019s teams', async () => {
      const admin = await createUser({ role: 'admin' });
      const other = await createUser();
      await createTeam(other._id, 'Theirs');

      const res = await request(app)
        .get('/teams')
        .query({ userId: other.uuid })
        .set('Authorization', tokenFor(admin));

      expect(res.status).toBe(200);
      expect(res.body[0].name).toBe('Theirs');
    });
  });

  describe('GET /teams/:id', () => {
    it('returns an owned team by uuid', async () => {
      const owner = await createUser();
      const team = await createTeam(owner._id);

      const res = await request(app)
        .get(`/teams/${team.uuid}`)
        .set('Authorization', tokenFor(owner));

      expect(res.status).toBe(200);
      expect(res.body.uuid).toBe(team.uuid);
    });

    it('returns an owned team by ObjectId', async () => {
      const owner = await createUser();
      const team = await createTeam(owner._id);

      const res = await request(app)
        .get(`/teams/${team._id.toString()}`)
        .set('Authorization', tokenFor(owner));

      expect(res.status).toBe(200);
    });

    it('hides a team owned by someone else', async () => {
      const owner = await createUser();
      const other = await createUser();
      const team = await createTeam(other._id);

      const res = await request(app)
        .get(`/teams/${team.uuid}`)
        .set('Authorization', tokenFor(owner));

      expect(res.status).toBe(404);
    });
  });

  describe('PUT /teams/:id', () => {
    it('updates an owned team', async () => {
      const owner = await createUser();
      const team = await createTeam(owner._id);

      const res = await request(app)
        .put(`/teams/${team.uuid}`)
        .set('Authorization', tokenFor(owner))
        .send({ name: 'Renamed', coach: 'New Coach' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Renamed');
      expect(res.body.coach).toBe('New Coach');
    });

    it('returns 403 when updating a team owned by someone else', async () => {
      const owner = await createUser();
      const other = await createUser();
      const team = await createTeam(other._id);

      const res = await request(app)
        .put(`/teams/${team.uuid}`)
        .set('Authorization', tokenFor(owner))
        .send({ name: 'Hijacked' });

      expect(res.status).toBe(403);
      expect(res.body).toEqual({ error: 'You do not own this team' });
    });

    it('returns 400 for an empty name', async () => {
      const owner = await createUser();
      const team = await createTeam(owner._id);

      const res = await request(app)
        .put(`/teams/${team.uuid}`)
        .set('Authorization', tokenFor(owner))
        .send({ name: '   ' });

      expect(res.status).toBe(400);
    });

    it('returns 404 for an unknown team', async () => {
      const owner = await createUser();

      const res = await request(app)
        .put('/teams/does-not-exist')
        .set('Authorization', tokenFor(owner))
        .send({ name: 'Renamed' });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /teams/:id', () => {
    it('deletes an owned team and unsets team on its players', async () => {
      const owner = await createUser();
      const team = await createTeam(owner._id);
      const player = await createPlayer(owner._id, team._id);

      const res = await request(app)
        .delete(`/teams/${team.uuid}`)
        .set('Authorization', tokenFor(owner));

      expect(res.status).toBe(204);
      expect(await Team.findById(team._id).lean()).toBeNull();

      const orphan = await Player.findById(player._id).lean();
      expect(orphan?.team).toBeUndefined();
    });

    it('returns 403 when deleting a team owned by someone else', async () => {
      const owner = await createUser();
      const other = await createUser();
      const team = await createTeam(other._id);

      const res = await request(app)
        .delete(`/teams/${team.uuid}`)
        .set('Authorization', tokenFor(owner));

      expect(res.status).toBe(403);
      expect(await Team.findById(team._id).lean()).not.toBeNull();
    });

    it('returns 404 for an unknown team', async () => {
      const owner = await createUser();

      const res = await request(app)
        .delete('/teams/does-not-exist')
        .set('Authorization', tokenFor(owner));

      expect(res.status).toBe(404);
    });
  });
});
