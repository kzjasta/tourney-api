import request from 'supertest';
import mongoose from 'mongoose';
import User from '../models/User';
import Team from '../models/Team';
import { app } from '../app';

jest.mock('../models/User');
jest.mock('../models/Team');

const mockedUser = User as jest.Mocked<typeof User>;
const mockedTeam = Team as jest.Mocked<typeof Team>;
const mockUserId = new mongoose.Types.ObjectId();
const mockUserDoc = {
  _id: mockUserId,
  uuid: 'user-uuid-123',
  username: 'johndoe',
  email: 'john@example.com',
};

describe('Users routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /users', () => {
    it('creates a user and returns 201 with user data', async () => {
      const created = {
        uuid: 'user-uuid-123',
        username: 'johndoe',
        email: 'john@example.com',
      };
      mockedUser.create.mockResolvedValue(created as never);

      const res = await request(app)
        .post('/users')
        .send({ username: 'johndoe', email: 'john@example.com' });

      expect(res.status).toBe(201);
      expect(res.body).toEqual({
        uuid: 'user-uuid-123',
        username: 'johndoe',
        email: 'john@example.com',
      });
      expect(mockedUser.create).toHaveBeenCalledWith({
        username: 'johndoe',
        email: 'john@example.com',
      });
    });

    it('trims username and lowercases email', async () => {
      mockedUser.create.mockResolvedValue({
        uuid: 'u',
        username: 'trimmed',
        email: 'lower@example.com',
      } as never);

      await request(app)
        .post('/users')
        .send({ username: '  trimmed  ', email: 'LOWER@Example.com' });

      expect(mockedUser.create).toHaveBeenCalledWith({
        username: 'trimmed',
        email: 'lower@example.com',
      });
    });

    it('returns 400 when username is missing', async () => {
      const res = await request(app)
        .post('/users')
        .send({ email: 'john@example.com' });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Username is required' });
      expect(mockedUser.create).not.toHaveBeenCalled();
    });

    it('returns 400 when username is empty string', async () => {
      const res = await request(app)
        .post('/users')
        .send({ username: '   ', email: 'john@example.com' });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Username is required' });
      expect(mockedUser.create).not.toHaveBeenCalled();
    });

    it('returns 400 when email is missing', async () => {
      const res = await request(app)
        .post('/users')
        .send({ username: 'johndoe' });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Email is required' });
      expect(mockedUser.create).not.toHaveBeenCalled();
    });

    it('returns 400 when email is empty string', async () => {
      const res = await request(app)
        .post('/users')
        .send({ username: 'johndoe', email: '   ' });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Email is required' });
      expect(mockedUser.create).not.toHaveBeenCalled();
    });

    it('returns 409 when email or username already exists (duplicate key)', async () => {
      const err = new Error('E11000 duplicate key');
      (err as Error & { code?: number }).code = 11000;
      mockedUser.create.mockRejectedValue(err);

      const res = await request(app)
        .post('/users')
        .send({ username: 'johndoe', email: 'john@example.com' });

      expect(res.status).toBe(409);
      expect(res.body).toEqual({
        error: 'A user with this email or username already exists',
      });
    });

    it('returns 500 on generic create error', async () => {
      mockedUser.create.mockRejectedValue(new Error('DB error'));

      const res = await request(app)
        .post('/users')
        .send({ username: 'johndoe', email: 'john@example.com' });

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Failed to create user' });
    });
  });

  describe('GET /users', () => {
    it('returns users and 200 with default limit', async () => {
      const users = [
        { uuid: 'u1', username: 'a', email: 'a@example.com' },
        { uuid: 'u2', username: 'b', email: 'b@example.com' },
      ];
      mockedUser.find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(users),
      } as never);

      const res = await request(app).get('/users');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(users);
      expect(mockedUser.find).toHaveBeenCalledWith();
      expect(mockedUser.find().limit(50)).toBeDefined();
    });

    it('respects limit and offset query', async () => {
      mockedUser.find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      } as never);

      await request(app).get('/users').query({ limit: 10, offset: 5 });

      const chain = mockedUser.find();
      expect(chain.skip).toHaveBeenCalledWith(5);
      expect(chain.limit).toHaveBeenCalledWith(10);
    });

    it('returns 500 on list error', async () => {
      mockedUser.find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockRejectedValue(new Error('DB error')),
      } as never);

      const res = await request(app).get('/users');

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Failed to list users' });
    });
  });

  describe('GET /users/:id', () => {
    it('returns user by ObjectId and 200', async () => {
      mockedUser.findOne.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockUserDoc),
      } as never);

      const res = await request(app).get(`/users/${mockUserId.toString()}`);

      expect(res.status).toBe(200);
      expect(res.body.uuid).toBe('user-uuid-123');
      expect(res.body.username).toBe('johndoe');
      expect(mockedUser.findOne).toHaveBeenCalledWith({ _id: mockUserId });
    });

    it('finds user by uuid when id is not 24-char ObjectId', async () => {
      mockedUser.findOne.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockUserDoc),
      } as never);

      await request(app).get('/users/user-uuid-123');

      expect(mockedUser.findOne).toHaveBeenCalledWith({
        uuid: 'user-uuid-123',
      });
    });

    it('returns 404 when user is not found', async () => {
      mockedUser.findOne.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(null),
      } as never);

      const res = await request(app).get(`/users/${mockUserId.toString()}`);

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'User not found' });
    });

    it('returns 500 on get error', async () => {
      mockedUser.findOne.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockRejectedValue(new Error('DB error')),
      } as never);

      const res = await request(app).get(`/users/${mockUserId.toString()}`);

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Failed to get user' });
    });
  });

  describe('PUT /users/:id', () => {
    it('updates user and returns 200', async () => {
      const updated = {
        ...mockUserDoc,
        username: 'newname',
        email: 'new@example.com',
      };
      mockedUser.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...mockUserDoc,
          save: jest.fn().mockResolvedValue(updated),
        }),
      } as never);

      const res = await request(app)
        .put(`/users/${mockUserId.toString()}`)
        .send({ username: 'newname', email: 'new@example.com' });

      expect(res.status).toBe(200);
      expect(res.body.username).toBe('newname');
      expect(res.body.email).toBe('new@example.com');
    });

    it('returns 404 when user is not found', async () => {
      mockedUser.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      } as never);

      const res = await request(app)
        .put(`/users/${mockUserId.toString()}`)
        .send({ username: 'x' });

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'User not found' });
    });

    it('returns 400 when username is empty', async () => {
      mockedUser.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUserDoc),
      } as never);

      const res = await request(app)
        .put(`/users/${mockUserId.toString()}`)
        .send({ username: '   ' });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        error: 'Username must be a non-empty string',
      });
    });

    it('returns 400 when email is empty', async () => {
      mockedUser.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUserDoc),
      } as never);

      const res = await request(app)
        .put(`/users/${mockUserId.toString()}`)
        .send({ email: '   ' });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Email must be a non-empty string' });
    });

    it('returns 409 on duplicate key', async () => {
      const docWithSave = {
        ...mockUserDoc,
        save: jest
          .fn()
          .mockRejectedValue(
            Object.assign(new Error('E11000'), { code: 11000 })
          ),
      };
      mockedUser.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(docWithSave),
      } as never);

      const res = await request(app)
        .put(`/users/${mockUserId.toString()}`)
        .send({ email: 'taken@example.com' });

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('already exists');
    });

    it('returns 500 on update error', async () => {
      mockedUser.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...mockUserDoc,
          save: jest.fn().mockRejectedValue(new Error('DB error')),
        }),
      } as never);

      const res = await request(app)
        .put(`/users/${mockUserId.toString()}`)
        .send({ username: 'x' });

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Failed to update user' });
    });
  });

  describe('DELETE /users/:id', () => {
    it('deletes user and returns 204', async () => {
      mockedUser.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUserDoc),
      } as never);
      mockedTeam.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(0),
      } as never);
      mockedUser.deleteOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ deletedCount: 1 }),
      } as never);

      const res = await request(app).delete(`/users/${mockUserId.toString()}`);

      expect(res.status).toBe(204);
      expect(mockedTeam.countDocuments).toHaveBeenCalledWith({
        createdBy: mockUserId,
      });
      expect(mockedUser.deleteOne).toHaveBeenCalledWith({ _id: mockUserId });
    });

    it('returns 404 when user is not found', async () => {
      mockedUser.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      } as never);

      const res = await request(app).delete(`/users/${mockUserId.toString()}`);

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'User not found' });
      expect(mockedTeam.countDocuments).not.toHaveBeenCalled();
    });

    it('returns 409 when user owns teams', async () => {
      mockedUser.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUserDoc),
      } as never);
      mockedTeam.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(2),
      } as never);

      const res = await request(app).delete(`/users/${mockUserId.toString()}`);

      expect(res.status).toBe(409);
      expect(res.body).toEqual({ error: 'Cannot delete user that owns teams' });
      expect(mockedUser.deleteOne).not.toHaveBeenCalled();
    });

    it('returns 500 on delete error', async () => {
      mockedUser.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUserDoc),
      } as never);
      mockedTeam.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(0),
      } as never);
      mockedUser.deleteOne.mockReturnValue({
        exec: jest.fn().mockRejectedValue(new Error('DB error')),
      } as never);

      const res = await request(app).delete(`/users/${mockUserId.toString()}`);

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Failed to delete user' });
    });
  });
});
