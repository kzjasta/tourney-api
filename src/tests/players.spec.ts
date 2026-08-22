import request from 'supertest';
import mongoose from 'mongoose';
import Player from '../models/Player';
import Team from '../models/Team';
import { app } from '../app';

jest.mock('../models/Player');
jest.mock('../models/Team');

const mockedPlayer = Player as jest.Mocked<typeof Player>;
const mockedTeam = Team as jest.Mocked<typeof Team>;

const mockPlayerId = new mongoose.Types.ObjectId();
const mockTeamId = new mongoose.Types.ObjectId();
const mockPlayerDoc = {
  _id: mockPlayerId,
  uuid: 'player-uuid-789',
  firstName: 'Jane',
  lastName: 'Doe',
  position: 'Setter',
  jerseyNumber: 7,
  team: mockTeamId,
};
const mockTeamDoc = {
  _id: mockTeamId,
  uuid: 'team-uuid-456',
  name: 'Warriors',
  coach: 'Coach Smith',
};

function chainPopulateLean<T>(value: T) {
  return {
    populate: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(value),
  };
}

function chainSelectLean<T>(value: T) {
  return {
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(value),
  };
}

describe('Players routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /players', () => {
    it('creates a player without team and returns 201', async () => {
      const created = {
        _id: mockPlayerId,
        uuid: 'player-uuid-789',
        firstName: 'Jane',
        lastName: 'Doe',
        team: null,
      };
      mockedPlayer.create.mockResolvedValue(created as never);
      mockedPlayer.findById.mockReturnValue(
        chainPopulateLean(created) as never
      );

      const res = await request(app)
        .post('/players')
        .send({ firstName: 'Jane', lastName: 'Doe' });

      expect(res.status).toBe(201);
      expect(res.body.firstName).toBe('Jane');
      expect(res.body.lastName).toBe('Doe');
      expect(mockedPlayer.create).toHaveBeenCalledWith({
        firstName: 'Jane',
        lastName: 'Doe',
        position: undefined,
        dateOfBirth: undefined,
        jerseyNumber: undefined,
        height: undefined,
        team: undefined,
      });
      expect(mockedTeam.updateOne).not.toHaveBeenCalled();
    });

    it('creates a player with team and adds to Team.players', async () => {
      mockedTeam.findById.mockReturnValue(
        chainSelectLean({ _id: mockTeamId }) as never
      );
      const created = { ...mockPlayerDoc, team: mockTeamId };
      mockedPlayer.create.mockResolvedValue(created as never);
      mockedPlayer.findById.mockReturnValue(
        chainPopulateLean(created) as never
      );
      mockedTeam.updateOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({}),
      } as never);

      const res = await request(app).post('/players').send({
        firstName: 'Jane',
        lastName: 'Doe',
        team: mockTeamId.toString(),
      });

      expect(res.status).toBe(201);
      expect(mockedTeam.findById).toHaveBeenCalledWith(mockTeamId.toString());
      expect(mockedTeam.updateOne).toHaveBeenCalledWith(
        { _id: mockTeamId },
        { $addToSet: { players: mockPlayerId } }
      );
    });

    it('finds team by uuid when team id is not ObjectId', async () => {
      mockedTeam.findOne.mockReturnValue(
        chainSelectLean({ _id: mockTeamId }) as never
      );
      const created = { ...mockPlayerDoc, team: mockTeamId };
      mockedPlayer.create.mockResolvedValue(created as never);
      mockedPlayer.findById.mockReturnValue(
        chainPopulateLean(created) as never
      );
      mockedTeam.updateOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({}),
      } as never);

      await request(app)
        .post('/players')
        .send({ firstName: 'Jane', lastName: 'Doe', team: 'team-uuid-456' });

      expect(mockedTeam.findOne).toHaveBeenCalledWith({
        uuid: 'team-uuid-456',
      });
    });

    it('returns 400 when firstName is missing', async () => {
      const res = await request(app).post('/players').send({ lastName: 'Doe' });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        error: 'First name and last name are required',
      });
      expect(mockedPlayer.create).not.toHaveBeenCalled();
    });

    it('returns 400 when lastName is missing', async () => {
      const res = await request(app)
        .post('/players')
        .send({ firstName: 'Jane' });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        error: 'First name and last name are required',
      });
    });

    it('returns 404 when team is not found', async () => {
      mockedTeam.findById.mockReturnValue(chainSelectLean(null) as never);

      const res = await request(app).post('/players').send({
        firstName: 'Jane',
        lastName: 'Doe',
        team: mockTeamId.toString(),
      });

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Team not found' });
      expect(mockedPlayer.create).not.toHaveBeenCalled();
    });

    it('returns 409 when jersey number already in use on team', async () => {
      mockedTeam.findById.mockReturnValue(
        chainSelectLean({ _id: mockTeamId }) as never
      );
      mockedPlayer.create.mockRejectedValue(
        new Error('Jersey number already in use on this team')
      );

      const res = await request(app).post('/players').send({
        firstName: 'Jane',
        lastName: 'Doe',
        team: mockTeamId.toString(),
        jerseyNumber: 7,
      });

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('Jersey number');
    });

    it('returns 500 on create error', async () => {
      mockedPlayer.create.mockRejectedValue(new Error('DB error'));

      const res = await request(app)
        .post('/players')
        .send({ firstName: 'Jane', lastName: 'Doe' });

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Failed to create player' });
    });
  });

  describe('GET /players', () => {
    it('returns players and 200', async () => {
      const players = [{ ...mockPlayerDoc }];
      mockedPlayer.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(players),
      } as never);

      const res = await request(app).get('/players');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].firstName).toBe('Jane');
    });

    it('filters by teamId when provided', async () => {
      mockedTeam.findById.mockReturnValue(
        chainSelectLean({ _id: mockTeamId }) as never
      );
      mockedPlayer.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      } as never);

      await request(app)
        .get('/players')
        .query({ teamId: mockTeamId.toString() });

      expect(mockedPlayer.find).toHaveBeenCalledWith({ team: mockTeamId });
    });

    it('returns 404 when teamId is invalid', async () => {
      mockedTeam.findById.mockReturnValue(chainSelectLean(null) as never);

      const res = await request(app)
        .get('/players')
        .query({ teamId: mockTeamId.toString() });

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Team not found' });
    });

    it('returns 500 on list error', async () => {
      mockedPlayer.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockRejectedValue(new Error('DB error')),
      } as never);

      const res = await request(app).get('/players');

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Failed to list players' });
    });
  });

  describe('GET /players/:id', () => {
    it('returns player by ObjectId and 200', async () => {
      mockedPlayer.findOne.mockReturnValue(
        chainPopulateLean(mockPlayerDoc) as never
      );

      const res = await request(app).get(`/players/${mockPlayerId.toString()}`);

      expect(res.status).toBe(200);
      expect(res.body.uuid).toBe('player-uuid-789');
      expect(res.body.firstName).toBe('Jane');
      expect(mockedPlayer.findOne).toHaveBeenCalledWith({ _id: mockPlayerId });
    });

    it('finds player by uuid when id is not 24-char ObjectId', async () => {
      mockedPlayer.findOne.mockReturnValue(
        chainPopulateLean(mockPlayerDoc) as never
      );

      const res = await request(app).get('/players/player-uuid-789');

      expect(res.status).toBe(200);
      expect(res.body.uuid).toBe('player-uuid-789');
      expect(mockedPlayer.findOne).toHaveBeenCalledWith({
        uuid: 'player-uuid-789',
      });
    });

    it('returns 404 when player is not found', async () => {
      mockedPlayer.findOne.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(null),
      } as never);

      const res = await request(app).get(`/players/${mockPlayerId.toString()}`);

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Player not found' });
    });

    it('returns 500 on get error', async () => {
      mockedPlayer.findOne.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockRejectedValue(new Error('DB error')),
      } as never);

      const res = await request(app).get(`/players/${mockPlayerId.toString()}`);

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Failed to get player' });
    });
  });

  describe('PUT /players/:id', () => {
    it('updates player and returns 200', async () => {
      const docWithSave = {
        ...mockPlayerDoc,
        team: mockTeamId,
        save: jest.fn().mockResolvedValue(undefined),
      };
      mockedPlayer.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(docWithSave),
      } as never);
      mockedPlayer.findById.mockReturnValue(
        chainPopulateLean({ ...docWithSave, firstName: 'Jan' }) as never
      );

      const res = await request(app)
        .put(`/players/${mockPlayerId.toString()}`)
        .send({ firstName: 'Jan' });

      expect(res.status).toBe(200);
      expect(res.body.firstName).toBe('Jan');
    });

    it('syncs Team.players when team changes', async () => {
      const newTeamId = new mongoose.Types.ObjectId();
      const docWithSave = {
        ...mockPlayerDoc,
        team: mockTeamId,
        save: jest.fn().mockResolvedValue(undefined),
      };
      mockedPlayer.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(docWithSave),
      } as never);
      mockedTeam.findById.mockReturnValue(
        chainSelectLean({ _id: newTeamId }) as never
      );
      mockedTeam.updateOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({}),
      } as never);
      mockedPlayer.findById.mockReturnValue(
        chainPopulateLean({ ...docWithSave, team: newTeamId }) as never
      );

      await request(app)
        .put(`/players/${mockPlayerId.toString()}`)
        .send({ team: newTeamId.toString() });

      expect(mockedTeam.updateOne).toHaveBeenCalledWith(
        { _id: mockTeamId },
        { $pull: { players: mockPlayerId } }
      );
      expect(mockedTeam.updateOne).toHaveBeenCalledWith(
        { _id: newTeamId },
        { $addToSet: { players: mockPlayerId } }
      );
    });

    it('returns 404 when player is not found', async () => {
      mockedPlayer.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      } as never);

      const res = await request(app)
        .put(`/players/${mockPlayerId.toString()}`)
        .send({ firstName: 'Jan' });

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Player not found' });
    });

    it('returns 404 when new team is not found', async () => {
      const docWithSave = {
        ...mockPlayerDoc,
        team: null,
        save: jest.fn(),
      };
      mockedPlayer.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(docWithSave),
      } as never);
      mockedTeam.findById.mockReturnValue(chainSelectLean(null) as never);

      const res = await request(app)
        .put(`/players/${mockPlayerId.toString()}`)
        .send({ team: new mongoose.Types.ObjectId().toString() });

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Team not found' });
    });

    it('returns 409 when jersey number already in use on team', async () => {
      const docWithSave = {
        ...mockPlayerDoc,
        save: jest
          .fn()
          .mockRejectedValue(
            new Error('Jersey number already in use on this team')
          ),
      };
      mockedPlayer.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(docWithSave),
      } as never);

      const res = await request(app)
        .put(`/players/${mockPlayerId.toString()}`)
        .send({ jerseyNumber: 7 });

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('Jersey number');
    });

    it('returns 500 on update error', async () => {
      const docWithSave = {
        ...mockPlayerDoc,
        save: jest.fn().mockRejectedValue(new Error('DB error')),
      };
      mockedPlayer.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(docWithSave),
      } as never);

      const res = await request(app)
        .put(`/players/${mockPlayerId.toString()}`)
        .send({ firstName: 'Jan' });

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Failed to update player' });
    });
  });

  describe('DELETE /players/:id', () => {
    it('removes player from team and deletes, returns 204', async () => {
      const docWithTeam = { ...mockPlayerDoc, team: mockTeamId };
      mockedPlayer.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(docWithTeam),
      } as never);
      mockedTeam.updateOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({}),
      } as never);
      mockedPlayer.deleteOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ deletedCount: 1 }),
      } as never);

      const res = await request(app).delete(
        `/players/${mockPlayerId.toString()}`
      );

      expect(res.status).toBe(204);
      expect(mockedTeam.updateOne).toHaveBeenCalledWith(
        { _id: mockTeamId },
        { $pull: { players: mockPlayerId } }
      );
      expect(mockedPlayer.deleteOne).toHaveBeenCalledWith({
        _id: mockPlayerId,
      });
    });

    it('deletes player without team and returns 204', async () => {
      const docNoTeam = { ...mockPlayerDoc, team: null };
      mockedPlayer.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(docNoTeam),
      } as never);
      mockedPlayer.deleteOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ deletedCount: 1 }),
      } as never);

      const res = await request(app).delete(
        `/players/${mockPlayerId.toString()}`
      );

      expect(res.status).toBe(204);
      expect(mockedTeam.updateOne).not.toHaveBeenCalled();
      expect(mockedPlayer.deleteOne).toHaveBeenCalledWith({
        _id: mockPlayerId,
      });
    });

    it('returns 404 when player is not found', async () => {
      mockedPlayer.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      } as never);

      const res = await request(app).delete(
        `/players/${mockPlayerId.toString()}`
      );

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Player not found' });
      expect(mockedTeam.updateOne).not.toHaveBeenCalled();
      expect(mockedPlayer.deleteOne).not.toHaveBeenCalled();
    });

    it('returns 500 on delete error', async () => {
      mockedPlayer.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ ...mockPlayerDoc, team: null }),
      } as never);
      mockedPlayer.deleteOne.mockReturnValue({
        exec: jest.fn().mockRejectedValue(new Error('DB error')),
      } as never);

      const res = await request(app).delete(
        `/players/${mockPlayerId.toString()}`
      );

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Failed to delete player' });
    });
  });
});
