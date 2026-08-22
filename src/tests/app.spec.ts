import request from 'supertest';
import { app } from '../app';

describe('Tourney API', () => {
  it('app is defined', () => {
    expect(app).toBeDefined();
  });

  it('responds to GET /', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(404);
  });
});
