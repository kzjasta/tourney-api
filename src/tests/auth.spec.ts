import request from 'supertest';
import { app } from '../app';
import User from '../models/User';
import {
  clearTestDb,
  connectTestDb,
  createUser,
  disconnectTestDb,
  tokenFor,
} from './helpers/db';

beforeAll(connectTestDb, 60000);
afterAll(disconnectTestDb);
beforeEach(clearTestDb);

const credentials = {
  username: 'coach',
  email: 'coach@example.com',
  password: 'password123',
};

describe('Auth routes', () => {
  describe('POST /auth/register', () => {
    it('creates an account and returns an access token', async () => {
      const res = await request(app).post('/auth/register').send(credentials);

      expect(res.status).toBe(201);
      expect(res.body.accessToken).toEqual(expect.any(String));
      expect(res.body.user).toEqual({
        uuid: expect.any(String),
        username: 'coach',
        email: 'coach@example.com',
        role: 'organizer',
      });
    });

    it('sets an httpOnly refresh cookie scoped to /auth', async () => {
      const res = await request(app).post('/auth/register').send(credentials);

      const cookie = res.headers['set-cookie'][0];
      expect(cookie).toContain('refreshToken=');
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('Path=/auth');
    });

    it('never returns the password hash', async () => {
      const res = await request(app).post('/auth/register').send(credentials);

      expect(JSON.stringify(res.body)).not.toContain('$2b$');
      expect(res.body.user.password).toBeUndefined();
    });

    it('rejects a password shorter than 8 characters', async () => {
      const res = await request(app)
        .post('/auth/register')
        .send({ ...credentials, password: 'short' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Password must be at least 8 characters');
    });

    it('rejects a missing email', async () => {
      const res = await request(app)
        .post('/auth/register')
        .send({ username: 'coach', password: 'password123' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Email is required');
    });

    it('returns 409 for a duplicate email', async () => {
      await createUser({ email: credentials.email });

      const res = await request(app).post('/auth/register').send(credentials);

      expect(res.status).toBe(409);
    });

    it('returns 409 for a duplicate username', async () => {
      await createUser({ username: credentials.username });

      const res = await request(app).post('/auth/register').send(credentials);

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('That username is already taken');
    });

    it('rejects a username that differs only by case', async () => {
      await createUser({ username: 'Coach' });

      const res = await request(app)
        .post('/auth/register')
        .send({ ...credentials, username: 'coach' });

      expect(res.status).toBe(409);
    });

    it('stores the password hashed, not in plain text', async () => {
      await request(app).post('/auth/register').send(credentials);

      const user = await User.findOne({ email: credentials.email })
        .select('+password')
        .lean();
      expect(user?.password).not.toBe(credentials.password);
      expect(user?.password).toMatch(/^\$2[aby]\$/);
    });
  });

  describe('POST /auth/login', () => {
    beforeEach(async () => {
      await request(app).post('/auth/register').send(credentials);
    });

    it('returns an access token for valid credentials', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({ email: credentials.email, password: credentials.password });

      expect(res.status).toBe(200);
      expect(res.body.accessToken).toEqual(expect.any(String));
    });

    it('is case-insensitive on email', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({ email: 'COACH@EXAMPLE.COM', password: credentials.password });

      expect(res.status).toBe(200);
    });

    it('returns the same error for a wrong password and an unknown email', async () => {
      const wrongPassword = await request(app)
        .post('/auth/login')
        .send({ email: credentials.email, password: 'wrongpassword' });

      const unknownEmail = await request(app)
        .post('/auth/login')
        .send({ email: 'nobody@example.com', password: credentials.password });

      expect(wrongPassword.status).toBe(401);
      expect(unknownEmail.status).toBe(401);
      expect(wrongPassword.body).toEqual({ error: 'Invalid credentials' });
      expect(unknownEmail.body).toEqual(wrongPassword.body);
    });
  });

  describe('GET /auth/me', () => {
    it('returns the authenticated user', async () => {
      const user = await createUser({ username: 'coach' });

      const res = await request(app)
        .get('/auth/me')
        .set('Authorization', tokenFor(user));

      expect(res.status).toBe(200);
      expect(res.body.username).toBe('coach');
      expect(res.body.password).toBeUndefined();
    });

    it('returns 401 without a token', async () => {
      const res = await request(app).get('/auth/me');

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: 'Authentication required' });
    });

    it('returns 401 for a tampered token', async () => {
      const user = await createUser();
      const tampered = `${tokenFor(user).slice(0, -2)}xx`;

      const res = await request(app)
        .get('/auth/me')
        .set('Authorization', tampered);

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: 'Invalid or expired token' });
    });

    it('returns 401 when the Bearer prefix is missing', async () => {
      const user = await createUser();
      const raw = tokenFor(user).replace('Bearer ', '');

      const res = await request(app).get('/auth/me').set('Authorization', raw);

      expect(res.status).toBe(401);
    });
  });

  describe('POST /auth/refresh', () => {
    it('issues a new access token from the refresh cookie', async () => {
      const agent = request.agent(app);
      await agent.post('/auth/register').send(credentials);

      const res = await agent.post('/auth/refresh');

      expect(res.status).toBe(200);
      expect(res.body.accessToken).toEqual(expect.any(String));
    });

    it('returns 401 without a refresh cookie', async () => {
      const res = await request(app).post('/auth/refresh');

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: 'Refresh token missing' });
    });

    it('stops working after logout revokes the token version', async () => {
      const agent = request.agent(app);
      const registered = await agent.post('/auth/register').send(credentials);

      const loggedOut = await agent
        .post('/auth/logout')
        .set('Authorization', `Bearer ${registered.body.accessToken}`);
      expect(loggedOut.status).toBe(204);

      const res = await agent.post('/auth/refresh');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /auth/logout', () => {
    it('requires authentication', async () => {
      const res = await request(app).post('/auth/logout');

      expect(res.status).toBe(401);
    });

    it('increments tokenVersion', async () => {
      const user = await createUser();

      await request(app)
        .post('/auth/logout')
        .set('Authorization', tokenFor(user));

      const updated = await User.findById(user._id).lean();
      expect(updated?.tokenVersion).toBe(1);
    });
  });
});
