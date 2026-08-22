import request from 'supertest';
import mongoose from 'mongoose';
import User from '../models/User';
import Team from '../models/Team';
import Player from '../models/Player';
import { app } from '../app';

jest.mock('../models/User');
jest.mock('../models/Team');
jest.mock('../models/Player');

const mockedUser = User as jest.Mocked<typeof User>;
const mockedTeam = Team as jest.Mocked<typeof Team>;
const mockedPlayer = Player as jest.Mocked<typeof Player>;

const mockUserId = new mongoose.Types.ObjectId();
const mockUser = {
  _id: mockUserId,
  uuid: 'user-uuid-123',
  username: 'coach',
  email: 'coach@example.com',
};

function chainPopulateLean<T>(value: T) {
  return {
    populate: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(value),
  };
}

describe('Teams routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /teams', () => {
    it('creates a team and returns 201 with team data', async () => {
      mockedUser.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      } as never);

      const createdTeam = {
        _id: new mongoose.Types.ObjectId(),
        name: 'Warriors',
        coach: 'Coach Smith',
        createdBy: mockUserId,
        players: [],
      };
      mockedTeam.create.mockResolvedValue(createdTeam as never);

      const populatedTeam = {
        ...createdTeam,
        createdBy: {
          uuid: mockUser.uuid,
          username: mockUser.username,
          email: mockUser.email,
        },
      };
      mockedTeam.findById.mockReturnValue(
        chainPopulateLean(populatedTeam) as never
      );

      const res = await request(app).post('/teams').send({
        name: 'Warriors',
        coach: 'Coach Smith',
        createdBy: mockUserId.toString(),
      });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Warriors');
      expect(res.body.coach).toBe('Coach Smith');
      expect(mockedUser.findOne).toHaveBeenCalledWith({ _id: mockUserId });
      expect(mockedTeam.create).toHaveBeenCalledWith({
        name: 'Warriors',
        coach: 'Coach Smith',
        createdBy: mockUserId,
        players: [],
      });
    });

    it('finds user by uuid when createdBy is not a 24-char ObjectId', async () => {
      mockedUser.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      } as never);

      const createdTeam = {
        _id: new mongoose.Types.ObjectId(),
        name: 'Eagles',
        createdBy: mockUserId,
        players: [],
      };
      mockedTeam.create.mockResolvedValue(createdTeam as never);
      mockedTeam.findById.mockReturnValue(
        chainPopulateLean(createdTeam) as never
      );

      await request(app)
        .post('/teams')
        .send({ name: 'Eagles', createdBy: 'user-uuid-123' });

      expect(mockedUser.findOne).toHaveBeenCalledWith({
        uuid: 'user-uuid-123',
      });
    });

    it('returns 400 when name is missing', async () => {
      const res = await request(app)
        .post('/teams')
        .send({ createdBy: mockUserId.toString() });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Team name is required' });
      expect(mockedUser.findOne).not.toHaveBeenCalled();
      expect(mockedTeam.create).not.toHaveBeenCalled();
    });

    it('returns 400 when name is empty string', async () => {
      const res = await request(app)
        .post('/teams')
        .send({ name: '   ', createdBy: mockUserId.toString() });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Team name is required' });
      expect(mockedTeam.create).not.toHaveBeenCalled();
    });

    it('returns 400 when createdBy is missing', async () => {
      const res = await request(app).post('/teams').send({ name: 'Warriors' });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'createdBy (user id) is required' });
      expect(mockedUser.findOne).not.toHaveBeenCalled();
      expect(mockedTeam.create).not.toHaveBeenCalled();
    });

    it('returns 404 when user is not found', async () => {
      mockedUser.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      } as never);

      const res = await request(app)
        .post('/teams')
        .send({ name: 'Warriors', createdBy: mockUserId.toString() });

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'User not found' });
      expect(mockedTeam.create).not.toHaveBeenCalled();
    });

    it('returns 500 on create error', async () => {
      mockedUser.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      } as never);
      mockedTeam.create.mockRejectedValue(new Error('DB error'));

      const res = await request(app)
        .post('/teams')
        .send({ name: 'Warriors', createdBy: mockUserId.toString() });

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Failed to create team' });
    });
  });

  describe('GET /teams', () => {
    it('returns teams for user and 200', async () => {
      mockedUser.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      } as never);

      const teams = [
        {
          _id: new mongoose.Types.ObjectId(),
          name: 'Warriors',
          createdBy: mockUserId,
          players: [],
        },
      ];
      mockedTeam.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(teams),
          }),
        }),
      } as never);

      const res = await request(app)
        .get('/teams')
        .query({ userId: mockUserId.toString() });

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toBe('Warriors');
      expect(mockedUser.findOne).toHaveBeenCalledWith({ _id: mockUserId });
      expect(mockedTeam.find).toHaveBeenCalledWith({ createdBy: mockUserId });
    });

    it('finds user by uuid when userId is not a 24-char ObjectId', async () => {
      mockedUser.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      } as never);
      mockedTeam.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue([]),
          }),
        }),
      } as never);

      await request(app).get('/teams').query({ userId: 'user-uuid-123' });

      expect(mockedUser.findOne).toHaveBeenCalledWith({
        uuid: 'user-uuid-123',
      });
    });

    it('returns 400 when userId query is missing', async () => {
      const res = await request(app).get('/teams');

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'userId query is required' });
      expect(mockedUser.findOne).not.toHaveBeenCalled();
      expect(mockedTeam.find).not.toHaveBeenCalled();
    });

    it('returns 404 when user is not found', async () => {
      mockedUser.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      } as never);

      const res = await request(app)
        .get('/teams')
        .query({ userId: mockUserId.toString() });

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'User not found' });
      expect(mockedTeam.find).not.toHaveBeenCalled();
    });

    it('returns 500 on list error', async () => {
      mockedUser.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      } as never);
      mockedTeam.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            lean: jest.fn().mockRejectedValue(new Error('DB error')),
          }),
        }),
      } as never);

      const res = await request(app)
        .get('/teams')
        .query({ userId: mockUserId.toString() });

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Failed to list teams' });
    });
  });

  describe('GET /teams/:id', () => {
    const mockTeamId = new mongoose.Types.ObjectId();
    const mockTeam = {
      _id: mockTeamId,
      uuid: 'team-uuid-456',
      name: 'Warriors',
      coach: 'Coach Smith',
      createdBy: mockUserId,
      players: [],
    };

    it('returns team by ObjectId and 200', async () => {
      const populatedTeam = {
        ...mockTeam,
        createdBy: {
          uuid: mockUser.uuid,
          username: mockUser.username,
          email: mockUser.email,
        },
      };
      mockedTeam.findOne.mockReturnValue(
        chainPopulateLean(populatedTeam) as never
      );

      const res = await request(app).get(`/teams/${mockTeamId.toString()}`);

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Warriors');
      expect(res.body.uuid).toBe('team-uuid-456');
      expect(mockedTeam.findOne).toHaveBeenCalledWith({ _id: mockTeamId });
    });

    it('finds team by uuid when id is not 24-char ObjectId', async () => {
      mockedTeam.findOne.mockReturnValue(chainPopulateLean(mockTeam) as never);

      const res = await request(app).get('/teams/team-uuid-456');

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Warriors');
      expect(mockedTeam.findOne).toHaveBeenCalledWith({
        uuid: 'team-uuid-456',
      });
    });

    it('returns 404 when team is not found', async () => {
      mockedTeam.findOne.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(null),
      } as never);

      const res = await request(app).get(`/teams/${mockTeamId.toString()}`);

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Team not found' });
    });

    it('returns 500 on get error', async () => {
      mockedTeam.findOne.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockRejectedValue(new Error('DB error')),
      } as never);

      const res = await request(app).get(`/teams/${mockTeamId.toString()}`);

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Failed to get team' });
    });
  });

  describe('PUT /teams/:id', () => {
    const mockTeamId = new mongoose.Types.ObjectId();
    const mockTeamDoc = {
      _id: mockTeamId,
      name: 'Warriors',
      coach: 'Coach Smith',
      createdBy: mockUserId,
      players: [],
    };

    it('updates team and returns 200', async () => {
      const updated = { ...mockTeamDoc, name: 'Eagles', coach: 'Coach Jones' };
      const populatedTeam = {
        ...updated,
        createdBy: {
          uuid: mockUser.uuid,
          username: mockUser.username,
          email: mockUser.email,
        },
      };
      mockedTeam.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...mockTeamDoc,
          save: jest.fn().mockResolvedValue(updated),
        }),
      } as never);
      mockedTeam.findById.mockReturnValue(
        chainPopulateLean(populatedTeam) as never
      );

      const res = await request(app)
        .put(`/teams/${mockTeamId.toString()}`)
        .send({ name: 'Eagles', coach: 'Coach Jones' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Eagles');
      expect(res.body.coach).toBe('Coach Jones');
    });

    it('returns 404 when team is not found', async () => {
      mockedTeam.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      } as never);

      const res = await request(app)
        .put(`/teams/${mockTeamId.toString()}`)
        .send({ name: 'Eagles' });

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Team not found' });
    });

    it('returns 400 when name is empty', async () => {
      mockedTeam.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockTeamDoc),
      } as never);

      const res = await request(app)
        .put(`/teams/${mockTeamId.toString()}`)
        .send({ name: '   ' });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        error: 'Team name must be a non-empty string',
      });
    });

    it('returns 500 on update error', async () => {
      mockedTeam.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...mockTeamDoc,
          save: jest.fn().mockRejectedValue(new Error('DB error')),
        }),
      } as never);

      const res = await request(app)
        .put(`/teams/${mockTeamId.toString()}`)
        .send({ name: 'Eagles' });

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Failed to update team' });
    });
  });

  describe('DELETE /teams/:id', () => {
    const mockTeamId = new mongoose.Types.ObjectId();
    const mockTeamDoc = {
      _id: mockTeamId,
      name: 'Warriors',
      createdBy: mockUserId,
      players: [],
    };

    it('deletes team and unsets team on players, returns 204', async () => {
      mockedTeam.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockTeamDoc),
      } as never);
      mockedPlayer.updateMany.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ modifiedCount: 2 }),
      } as never);
      mockedTeam.deleteOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ deletedCount: 1 }),
      } as never);

      const res = await request(app).delete(`/teams/${mockTeamId.toString()}`);

      expect(res.status).toBe(204);
      expect(mockedPlayer.updateMany).toHaveBeenCalledWith(
        { team: mockTeamId },
        { $unset: { team: 1 } }
      );
      expect(mockedTeam.deleteOne).toHaveBeenCalledWith({ _id: mockTeamId });
    });

    it('returns 404 when team is not found', async () => {
      mockedTeam.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      } as never);

      const res = await request(app).delete(`/teams/${mockTeamId.toString()}`);

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Team not found' });
      expect(mockedPlayer.updateMany).not.toHaveBeenCalled();
      expect(mockedTeam.deleteOne).not.toHaveBeenCalled();
    });

    it('returns 500 on delete error', async () => {
      mockedTeam.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockTeamDoc),
      } as never);
      mockedPlayer.updateMany.mockReturnValue({
        exec: jest.fn().mockResolvedValue({}),
      } as never);
      mockedTeam.deleteOne.mockReturnValue({
        exec: jest.fn().mockRejectedValue(new Error('DB error')),
      } as never);

      const res = await request(app).delete(`/teams/${mockTeamId.toString()}`);

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Failed to delete team' });
    });
  });
});
