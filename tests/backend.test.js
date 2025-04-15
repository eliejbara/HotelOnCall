// __tests__/backend.test.js

jest.setTimeout(100000); // Increase timeout for async operations

// --- Mocks ---
jest.mock('passport', () => ({
  authenticate: jest.fn(() => (req, res, next) => next()),
  initialize: jest.fn(() => (req, res, next) => {
    req.user = { email: 'testuser@example.com', userType: 'guest' };
    next();
  }),
  session: jest.fn(() => (req, res, next) => next()),
  serializeUser: jest.fn(),
  deserializeUser: jest.fn(),
  use: jest.fn(),
}));

jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    query: jest.fn(),
    connect: jest.fn(),
  })),
}));

jest.mock('axios');
jest.mock('../db', () => ({
  query: jest.fn().mockResolvedValue({}),
}));

const request = require('supertest');
const axios = require('axios');
const { Pool } = require('pg');
const db = require('../db');

// --- App ---
const app = require('../server');

// --- Session mock ---
let mockSession = {};
app.use((req, res, next) => {
  req.session = mockSession;
  next();
});

// --- Prediction API mock response ---
const mockPredictionData = { prediction: 'high' };

// --- TEST SUITE ---
describe('HotelOnCall Backend Tests', () => {
  let dbInstance;

  beforeEach(() => {
    dbInstance = new Pool();
    mockSession = {};
    jest.clearAllMocks();
  });

  // --- Registration ---
  describe('POST /register', () => {
    it('registers a new user', async () => {
      const user = { email: 'test@example.com', password: '123', userType: 'guest' };
      dbInstance.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      dbInstance.query.mockResolvedValueOnce({ rows: [{ email: user.email }], rowCount: 1 });

      const res = await request(app).post('/register').send(user);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('fails if user exists', async () => {
      const user = { email: 'test@example.com', password: '123', userType: 'guest' };
      dbInstance.query.mockResolvedValueOnce({ rows: [user], rowCount: 1 });

      const res = await request(app).post('/register').send(user);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(false);
    });
  });

  // --- Login ---
  describe('POST /login', () => {
    it('logs in user', async () => {
      const user = { email: 'test@example.com', password: 'password123', userType: 'guest' };
      dbInstance.query.mockResolvedValueOnce({
        rows: [{ email: user.email, password: 'hashedPassword', userType: user.userType }],
      });

      const res = await request(app).post('/login').send(user);
      expect(res.status).toBe(200);
    });

    it('fails for invalid credentials', async () => {
      const user = { email: 'test@example.com', password: 'wrong', userType: 'guest' };
      dbInstance.query.mockResolvedValueOnce({
        rows: [{ email: user.email, password: 'hashedPassword', userType: user.userType }],
      });

      const res = await request(app).post('/login').send(user);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(false);
    });
  });

  // --- Google OAuth Redirects ---
  describe('GET /auth/google/callback', () => {
    it('redirects guest to /guest_services.html if already checked in', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ email: 'testuser@example.com', userType: 'guest', id: 'guestId' }],
      });
      db.query.mockResolvedValueOnce({ rows: [{ guest_id: 'guestId' }] });

      const res = await request(app).get('/auth/google/callback?success=true');
      expect(res.status).toBe(302);
      expect(res.header.location).toContain('/guest_services.html');
    });

    it('redirects guest to /checkin.html if not checked in', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ email: 'testuser@example.com', userType: 'guest', id: 'guestId' }],
      });
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/auth/google/callback?success=true');
      expect(res.status).toBe(302);
      expect(res.header.location).toContain('/checkin.html');
    });

    it('redirects staff to /staff_selection.html', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ email: 'staff@example.com', userType: 'staff', id: 'staffId' }],
      });

      const res = await request(app).get('/auth/google/callback?success=true');
      expect(res.status).toBe(302);
      expect(res.header.location).toContain('/staff_selection.html');
    });

    it('redirects manager to /manager_dashboard.html', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ email: 'manager@example.com', userType: 'manager', id: 'managerId' }],
      });

      const res = await request(app).get('/auth/google/callback?success=true');
      expect(res.status).toBe(302);
      expect(res.header.location).toContain('/manager_dashboard.html');
    });
  });

  // --- Prediction API ---
  describe('GET /api/guest-prediction', () => {
    it('returns prediction data', async () => {
      axios.get.mockResolvedValueOnce({ data: mockPredictionData });
      const res = await request(app).get('/api/guest-prediction?date=2025-05-01');
      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockPredictionData);
    });

    it('returns error on missing date', async () => {
      const res = await request(app).get('/api/guest-prediction');
      expect(res.status).toBe(400);
    });
  });

  // --- Available Rooms ---
  describe('GET /available-rooms', () => {
    it('returns available rooms', async () => {
      dbInstance.query.mockResolvedValueOnce({ rows: [{ room_number: 101 }] });
      const res = await request(app).get('/available-rooms');
      expect(res.status).toBe(200);
    });

    it('handles db error', async () => {
      dbInstance.query.mockRejectedValueOnce(new Error('fail'));
      const res = await request(app).get('/available-rooms');
      expect(res.status).toBe(500);
    });
  });

  // --- Place Order ---
  describe('POST /place-order', () => {
    it('places order', async () => {
      const order = {
        guestEmail: 'testuser@example.com',
        orderItems: [{ name: 'Pizza', price: 10, quantity: 1 }],
      };
      dbInstance.query.mockResolvedValueOnce({});
      const res = await request(app).post('/place-order').send(order);
      expect(res.status).toBe(200);
    });

    it('fails if empty order', async () => {
      const order = { guestEmail: 'testuser@example.com', orderItems: [] };
      const res = await request(app).post('/place-order').send(order);
      expect(res.status).toBe(400);
    });
  });

  // --- Check Order ---
  describe('GET /check-order/:guestEmail', () => {
    it('returns guest order', async () => {
      dbInstance.query.mockResolvedValueOnce({
        rows: [{ order_id: 1, status: 'Pending', item_name: 'Pizza', total_price: 20 }],
      });
      const res = await request(app).get('/check-order/testuser@example.com');
      expect(res.status).toBe(200);
    });

    it('handles no orders', async () => {
      dbInstance.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).get('/check-order/testuser@example.com');
      expect(res.status).toBe(404);
    });
  });

  // --- Check-in ---
  describe('POST /checkin', () => {
    it('checks in successfully', async () => {
      dbInstance.query.mockResolvedValueOnce({});
      const res = await request(app).post('/checkin').send({
        guestEmail: 'testuser@example.com',
        checkinDate: '2025-05-01',
      });
      expect(res.status).toBe(200);
    });

    it('handles check-in failure', async () => {
      dbInstance.query.mockRejectedValueOnce(new Error('fail'));
      const res = await request(app).post('/checkin').send({
        guestEmail: 'testuser@example.com',
        checkinDate: '2025-05-01',
      });
      expect(res.status).toBe(500);
    });
  });

  // --- Checkout ---
  describe('POST /checkout', () => {
    it('checks out successfully', async () => {
      dbInstance.query.mockResolvedValueOnce({});
      const res = await request(app).post('/checkout').send({
        guestEmail: 'testuser@example.com',
      });
      expect(res.status).toBe(200);
    });

    it('handles checkout failure', async () => {
      dbInstance.query.mockRejectedValueOnce(new Error('fail'));
      const res = await request(app).post('/checkout').send({
        guestEmail: 'testuser@example.com',
      });
      expect(res.status).toBe(500);
    });
  });
});
