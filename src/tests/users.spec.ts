import request from 'supertest';
import { app } from '../app';
import User from '../models/User';
import {
  clearTestDb,
  connectTestDb,
  createTeam,
  createUser,
  disconnectTestDb,
  tokenFor,
} from './helpers/db';

beforeAll(connectTestDb, 60000);
afterAll(disconnectTestDb);
beforeEach(clearTestDb);

describe('Users routes', () => {
  it('returns 401 without a token', async () => {
    const res = await request(app).get('/users');

    expect(res.status).toBe(401);
  });

  describe('GET /users', () => {
    it('lists users for an admin', async () => {
      const admin = await createUser({ role: 'admin' });
      await createUser();

      const res = await request(app)
        .get('/users')
        .set('Authorization', tokenFor(admin));

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(JSON.stringify(res.body)).not.toContain('$2b$');
    });

    it('returns 403 for a non-admin', async () => {
      const user = await createUser();

      const res = await request(app)
        .get('/users')
        .set('Authorization', tokenFor(user));

      expect(res.status).toBe(403);
      expect(res.body).toEqual({ error: 'Insufficient permissions' });
    });

    it('respects limit and offset for an admin', async () => {
      const admin = await createUser({ role: 'admin' });
      await createUser();
      await createUser();

      const res = await request(app)
        .get('/users')
        .query({ limit: 2, offset: 1 })
        .set('Authorization', tokenFor(admin));

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
    });
  });

  describe('GET /users/:id', () => {
    it('returns the caller\u2019s own account', async () => {
      const user = await createUser({ username: 'self' });

      const res = await request(app)
        .get(`/users/${user.uuid}`)
        .set('Authorization', tokenFor(user));

      expect(res.status).toBe(200);
      expect(res.body.username).toBe('self');
      expect(res.body.password).toBeUndefined();
    });

    it('returns 403 for another user\u2019s account', async () => {
      const user = await createUser();
      const other = await createUser();

      const res = await request(app)
        .get(`/users/${other.uuid}`)
        .set('Authorization', tokenFor(user));

      expect(res.status).toBe(403);
    });

    it('lets an admin read any account', async () => {
      const admin = await createUser({ role: 'admin' });
      const other = await createUser({ username: 'target' });

      const res = await request(app)
        .get(`/users/${other.uuid}`)
        .set('Authorization', tokenFor(admin));

      expect(res.status).toBe(200);
      expect(res.body.username).toBe('target');
    });

    it('returns 404 for an unknown user', async () => {
      const admin = await createUser({ role: 'admin' });

      const res = await request(app)
        .get('/users/does-not-exist')
        .set('Authorization', tokenFor(admin));

      expect(res.status).toBe(404);
    });
  });

  describe('PUT /users/:id', () => {
    it('updates the caller\u2019s own username and email', async () => {
      const user = await createUser();

      const res = await request(app)
        .put(`/users/${user.uuid}`)
        .set('Authorization', tokenFor(user))
        .send({ username: 'renamed', email: 'RENAMED@Example.com' });

      expect(res.status).toBe(200);
      expect(res.body.username).toBe('renamed');
      expect(res.body.email).toBe('renamed@example.com');
    });

    it('rejects a role change', async () => {
      const user = await createUser();

      const res = await request(app)
        .put(`/users/${user.uuid}`)
        .set('Authorization', tokenFor(user))
        .send({ role: 'admin' });

      expect(res.status).toBe(400);

      const unchanged = await User.findById(user._id).lean();
      expect(unchanged?.role).toBe('organizer');
    });

    it('rejects a direct password write', async () => {
      const user = await createUser();

      const res = await request(app)
        .put(`/users/${user.uuid}`)
        .set('Authorization', tokenFor(user))
        .send({ password: 'newpassword123' });

      expect(res.status).toBe(400);
    });

    it('returns 403 when updating another user', async () => {
      const user = await createUser();
      const other = await createUser();

      const res = await request(app)
        .put(`/users/${other.uuid}`)
        .set('Authorization', tokenFor(user))
        .send({ username: 'hijacked' });

      expect(res.status).toBe(403);
    });

    it('returns 400 for an empty username', async () => {
      const user = await createUser();

      const res = await request(app)
        .put(`/users/${user.uuid}`)
        .set('Authorization', tokenFor(user))
        .send({ username: '   ' });

      expect(res.status).toBe(400);
    });

    it('returns 409 when the email is already taken', async () => {
      const user = await createUser();
      const other = await createUser({ email: 'taken@example.com' });

      const res = await request(app)
        .put(`/users/${user.uuid}`)
        .set('Authorization', tokenFor(user))
        .send({ email: other.email });

      expect(res.status).toBe(409);
    });

    it('returns 409 when the username is already taken', async () => {
      const user = await createUser();
      const other = await createUser({ username: 'taken' });

      const res = await request(app)
        .put(`/users/${user.uuid}`)
        .set('Authorization', tokenFor(user))
        .send({ username: other.username });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('That username is already taken');
    });
  });

  describe('DELETE /users/:id', () => {
    it('deletes the caller\u2019s own account when they own no teams', async () => {
      const user = await createUser();

      const res = await request(app)
        .delete(`/users/${user.uuid}`)
        .set('Authorization', tokenFor(user));

      expect(res.status).toBe(204);
      expect(await User.findById(user._id).lean()).toBeNull();
    });

    it('returns 409 when the user still owns teams', async () => {
      const user = await createUser();
      await createTeam(user._id);

      const res = await request(app)
        .delete(`/users/${user.uuid}`)
        .set('Authorization', tokenFor(user));

      expect(res.status).toBe(409);
      expect(res.body).toEqual({
        error: 'Cannot delete user that owns teams',
      });
    });

    it('returns 403 when deleting another user', async () => {
      const user = await createUser();
      const other = await createUser();

      const res = await request(app)
        .delete(`/users/${other.uuid}`)
        .set('Authorization', tokenFor(user));

      expect(res.status).toBe(403);
      expect(await User.findById(other._id).lean()).not.toBeNull();
    });
  });
});
