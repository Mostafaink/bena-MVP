const request = require('supertest');

// Use an in-memory database for tests
process.env.DB_PATH = ':memory:';
process.env.JWT_SECRET = 'test_secret_123';

const app = require('../src/app');
const { closeDb } = require('../src/db/database');

let aliceToken;
let bobToken;
let listingId;

beforeAll(async () => {
  // Seed two users; these run before every describe block
  await request(app).post('/api/auth/register').send({ name: 'Alice', email: 'alice@example.com', password: 'secret123' });
  await request(app).post('/api/auth/register').send({ name: 'Bob', email: 'bob@example.com', password: 'secret123' });

  aliceToken = (await request(app).post('/api/auth/login').send({ email: 'alice@example.com', password: 'secret123' })).body.token;
  bobToken = (await request(app).post('/api/auth/login').send({ email: 'bob@example.com', password: 'secret123' })).body.token;
});

afterAll(() => {
  closeDb();
});

// ── Health ────────────────────────────────────────────────────────────────────

describe('GET /health', () => {
  it('returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

// ── Auth ──────────────────────────────────────────────────────────────────────

describe('POST /api/auth/register', () => {
  it('registers a new user and returns a token', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Carol',
      email: 'carol@example.com',
      password: 'secret123',
    });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user.email).toBe('carol@example.com');
  });

  it('rejects duplicate email', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Alice',
      email: 'alice@example.com',
      password: 'secret123',
    });
    expect(res.status).toBe(409);
  });

  it('validates required fields', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: 'bad' });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('errors');
  });
});

describe('POST /api/auth/login', () => {
  it('returns a token with valid credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'alice@example.com',
      password: 'secret123',
    });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
  });

  it('rejects wrong password', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'alice@example.com',
      password: 'wrongpassword',
    });
    expect(res.status).toBe(401);
  });

  it('rejects unknown email', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'nobody@example.com',
      password: 'secret123',
    });
    expect(res.status).toBe(401);
  });
});

// ── Listings ──────────────────────────────────────────────────────────────────

describe('POST /api/listings', () => {
  it('requires authentication', async () => {
    const res = await request(app).post('/api/listings').send({ title: 'Test', price: 10 });
    expect(res.status).toBe(401);
  });

  it('creates a listing', async () => {
    const res = await request(app)
      .post('/api/listings')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ title: 'Vintage Lamp', description: 'Great condition', price: 25.5 });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Vintage Lamp');
    listingId = res.body.id;
  });

  it('validates price', async () => {
    const res = await request(app)
      .post('/api/listings')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ title: 'Bad', price: -5 });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/listings', () => {
  it('returns all listings', async () => {
    const res = await request(app).get('/api/listings');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });
});

describe('GET /api/listings/:id', () => {
  it('returns a single listing', async () => {
    const res = await request(app).get(`/api/listings/${listingId}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(listingId);
  });

  it('returns 404 for unknown id', async () => {
    const res = await request(app).get('/api/listings/99999');
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/listings/:id', () => {
  it('updates the listing', async () => {
    const res = await request(app)
      .patch(`/api/listings/${listingId}`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ price: 30 });
    expect(res.status).toBe(200);
    expect(res.body.price).toBe(30);
  });

  it('rejects update by another user', async () => {
    const res = await request(app)
      .patch(`/api/listings/${listingId}`)
      .set('Authorization', `Bearer ${bobToken}`)
      .send({ title: 'Hijacked' });
    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/listings/:id', () => {
  it('rejects delete by another user', async () => {
    const res = await request(app)
      .delete(`/api/listings/${listingId}`)
      .set('Authorization', `Bearer ${bobToken}`);
    expect(res.status).toBe(403);
  });

  it('deletes the listing', async () => {
    const res = await request(app)
      .delete(`/api/listings/${listingId}`)
      .set('Authorization', `Bearer ${aliceToken}`);
    expect(res.status).toBe(204);
  });

  it('returns 404 after deletion', async () => {
    const res = await request(app).get(`/api/listings/${listingId}`);
    expect(res.status).toBe(404);
  });
});

