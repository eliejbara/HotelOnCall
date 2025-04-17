jest.mock('passport', () => ({
  serializeUser: jest.fn(),
  deserializeUser: jest.fn(),
  initialize: jest.fn(() => (req, res, next) => next()),
  session: jest.fn(() => (req, res, next) => next()),
  authenticate: jest.fn(() => (req, res, next) => next()),
  use: jest.fn(),
  Strategy: function () {}
}));

jest.mock('../db', () => ({
  query: jest.fn()
}));
jest.mock('passport-google-oauth20', () => ({
  Strategy: function () {}
}));

const request = require('supertest');
const mockDb = require('../db');
const app = require('../server');

process.env.GOOGLE_CLIENT_ID = 'mock-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'mock-client-secret';

describe('HotelOnCall Backend API', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockDb.query.mockImplementation((sql, params) => {
      if (sql.includes('SELECT * FROM guests WHERE email')) {
        return Promise.resolve({ rows: [{ room_number: 101 }] });
      }
      if (sql.includes('SELECT * FROM guests WHERE room_number')) {
        return Promise.resolve({ rows: [{ email: 'john@example.com' }] });
      }
      if (sql.includes('INSERT INTO guests')) {
        return Promise.resolve({ rowCount: 1 });
      }
      if (sql.includes('DELETE FROM orders')) {
        return Promise.resolve({ rowCount: 1 });
      }
      if (sql.includes('DELETE FROM cleaning_requests')) {
        return Promise.resolve({ rowCount: 1 });
      }
      if (sql.includes('DELETE FROM maintenance_requests')) {
        return Promise.resolve({ rowCount: 1 });
      }
      if (sql.includes('DELETE FROM guests')) {
        return Promise.resolve({ rowCount: 1 });
      }
      if (sql.includes('SELECT * FROM cleaning_slots WHERE room_number')) {
        return Promise.resolve({
          rows: [{ id: 1, room_number: 101, date: '2025-04-20', time: '10:00 AM', available: true }]
        });
      }
      if (sql.includes('UPDATE cleaning_slots SET available = false')) {
        return Promise.resolve({ rowCount: 1 });
      }
      if (sql.includes('INSERT INTO cleaning_requests')) {
        return Promise.resolve({ rowCount: 1 });
      }
      if (sql.includes('UPDATE cleaning_requests SET status')) {
        return Promise.resolve({ rowCount: 1 });
      }
      if (sql.includes('SELECT * FROM cleaning_requests WHERE guest_email')) {
        return Promise.resolve({ rows: [{ id: 1, guest_email: 'john@example.com', status: 'Pending' }] });
      }
      if (sql.includes('SELECT * FROM cleaning_requests WHERE status')) {
        return Promise.resolve({
          rows: [{ id: 1, room_number: 101, date: '2025-04-20', time: '10:00 AM', status: 'Pending' }]
        });
      }
      if (sql.includes('INSERT INTO orders')) {
        return Promise.resolve({ rowCount: 1 });
      }
      if (sql.includes('SELECT * FROM orders')) {
        return Promise.resolve({
          rows: [{ order_id: 1, username: 'john@example.com', food_item: 'Pizza', status: 'Pending' }]
        });
      }
      if (sql.includes('UPDATE orders SET status')) {
        return Promise.resolve({ rowCount: 1 });
      }
      if (sql.includes('SELECT * FROM maintenance_requests')) {
        // Simulating a response for GET /maintenance-requests
        return Promise.resolve({
          rows: [{ id: 1, guest_email: 'john@example.com', issue: 'Air conditioner broken', status: 'Pending' }]
        });
      }
      if (sql.includes('INSERT INTO maintenance_requests')) {
        return Promise.resolve({ rowCount: 1 });
      }
      if (sql.includes('UPDATE maintenance_requests')) {
        // Simulating a successful update for POST /update-maintenance-status
        return Promise.resolve({ rowCount: 1 });
      }
      if (sql.includes('SELECT feedback_text FROM feedback')) {
        return Promise.resolve({ rows: [{ feedback_text: 'Great stay!' }] });
      }
      if (sql.includes('SELECT status, COUNT(*) as count FROM cleaning_requests')) {
        return Promise.resolve({ rows: [{ status: 'Resolved', count: 5 }, { status: 'Pending', count: 3 }] });
      }
      if (sql.includes('SELECT room_number FROM guests WHERE email')) {
        return Promise.resolve({ rows: [{ room_number: 101 }] });
      }
      if (sql.includes('SELECT price_per_night FROM rooms')) {
        return Promise.resolve({ rows: [{ price_per_night: 100 }] });
      }
      if (sql.includes('SELECT checkin_time FROM guests WHERE email')) {
        return Promise.resolve({ rows: [{ checkin_time: new Date(Date.now() - 86400000) }] }); // 1 day ago
      }
      return Promise.resolve({ rows: [] });
    });
  });

  it('POST /checkin', async () => {
    const res = await request(app).post('/checkin').send({
      guestEmail: 'john@example.com',
      roomNumber: 101
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('POST /checkout', async () => {
    const res = await request(app).post('/checkout').send({
      guestEmail: 'john@example.com'
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('POST /place-order', async () => {
    const res = await request(app).post('/place-order').send({
      guestEmail: 'john@example.com',
      foodItem: 'Pizza',
      quantity: 1
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('GET /cook/orders', async () => {
    const res = await request(app).get('/cook/orders');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST /cook/update-order', async () => {
    const res = await request(app).post('/cook/update-order').send({
      orderId: 1,
      status: 'Completed'
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('GET /guest-room', async () => {
    const res = await request(app).get('/guest-room').query({
      guestEmail: 'john@example.com'
    });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ room_number: 101 });
  });

  it('GET /available-cleaning-slots', async () => {
    const res = await request(app).get('/available-cleaning-slots').query({
      room_number: 101
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('POST /request-cleaning', async () => {
    const res = await request(app).post('/request-cleaning').send({
      guestEmail: 'john@example.com',
      date: '2025-04-20',
      time: '10:00 AM'
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('GET /guest-cleaning', async () => {
    const res = await request(app).get('/guest-cleaning').query({
      guestEmail: 'john@example.com'
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('POST /update-cleaning-status', async () => {
    const res = await request(app).post('/update-cleaning-status').send({
      id: 1,
      status: 'Resolved',
      room_number: 101
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('GET /cleaning-requests', async () => {
    const res = await request(app).get('/cleaning-requests');
    expect(res.statusCode).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('POST /maintenance-requests', async () => {
    const res = await request(app).post('/maintenance-requests').send({
      guestEmail: 'john@example.com',
      issue: 'Air conditioner broken'
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('GET /maintenance-requests', async () => {
    const res = await request(app).get('/maintenance-requests');
    expect(res.statusCode).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('POST /update-maintenance-status', async () => {
    const res = await request(app).post('/update-maintenance-status').send({
      id: 1,
      status: 'Resolved'
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
