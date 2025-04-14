// Set NODE_ENV to test so your server can behave differently during tests
process.env.NODE_ENV = 'test';
jest.mock('passport', () => {
  return {
    authenticate: () => (req, res, next) => next(),
    initialize: () => (req, res, next) => next(),
    session: () => (req, res, next) => next(),
  };
});

// __tests__/googleAuth.test.js

jest.setTimeout(100000);  // Increase timeout to 10 seconds

// Your other test code follows...

// Prevent process.exit from actually terminating tests
jest.spyOn(process, 'exit').mockImplementation(() => {});

// ----- Mock Modules BEFORE requiring your server -----
jest.mock('passport', () => ({
  initialize: jest.fn(() => (req, res, next) => next()),
  session: jest.fn(() => (req, res, next) => next()),
  use: jest.fn(),
  serializeUser: jest.fn(),
  deserializeUser: jest.fn(),
}));

jest.mock('passport-google-oauth20', () => ({
  Strategy: jest.fn(),
}));

// Mock the PostgreSQL database
jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    query: jest.fn(),
    connect: jest.fn(),
  })),
}));

// Also mock axios for your prediction API tests
jest.mock('axios');

// Now require your server after setting up mocks
const request = require('supertest');
const app = require('../server'); // ensure this points to your server.js file
const { Pool } = require('pg');
const axios = require('axios');

// Mock response data for the prediction API
const mockPredictionData = { prediction: 'high' };

describe('HotelOnCall Backend Routes', () => {
  let db;

  beforeEach(() => {
    db = new Pool();
    // Clear out any previous mock calls for db.query
    db.query.mockReset();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // =========================
  // User Registration Tests
  // =========================
  describe('POST /register', () => {
    it('should register a new user', async () => {
      const newUser = {
        email: 'testuser@example.com',
        password: 'password123',
        userType: 'guest',
      };

      db.query.mockResolvedValueOnce({ rows: [] }); // No existing user
      db.query.mockResolvedValueOnce({});            // Insert new user

      const res = await request(app)
        .post('/register')
        .send(newUser);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('User registered successfully!');
    });

    it('should return error if user already exists', async () => {
      const newUser = {
        email: 'existinguser@example.com',
        password: 'password123',
        userType: 'guest',
      };

      db.query.mockResolvedValueOnce({ rows: [{ email: 'existinguser@example.com' }] }); // Existing user

      const res = await request(app)
        .post('/register')
        .send(newUser);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('User already exists!');
    });
  });

  // =========================
  // User Login Tests
  // =========================
  describe('POST /login', () => {
    it('should login an existing user', async () => {
      const user = {
        email: 'testuser@example.com',
        password: 'password123',
        userType: 'guest',
      };

      db.query.mockResolvedValueOnce({
        rows: [
          {
            email: 'testuser@example.com',
            password: 'hashedPassword',
            userType: 'guest',
          },
        ],
      });

      const res = await request(app)
        .post('/login')
        .send(user);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Login successful!');
    });

    it('should return error for invalid credentials', async () => {
      const user = {
        email: 'testuser@example.com',
        password: 'wrongpassword',
        userType: 'guest',
      };

      db.query.mockResolvedValueOnce({
        rows: [
          {
            email: 'testuser@example.com',
            password: 'hashedPassword',
            userType: 'guest',
          },
        ],
      });

      const res = await request(app)
        .post('/login')
        .send(user);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Invalid credentials!');
    });
  });

  // =========================
  // Google Prediction API Tests
  // =========================
  describe('GET /api/guest-prediction', () => {
    it('should return guest prediction data', async () => {
      axios.get.mockResolvedValueOnce({ data: mockPredictionData });

      const res = await request(app).get('/api/guest-prediction?date=2025-05-01');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockPredictionData);
    });

    it('should return an error for missing date parameter', async () => {
      const res = await request(app).get('/api/guest-prediction');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Date parameter is required (YYYY-MM-DD)');
    });
  });

  // =========================
  // Available Rooms Tests
  // =========================
  describe('GET /available-rooms', () => {
    it('should return available rooms', async () => {
      const mockRooms = [{ room_number: 101 }, { room_number: 102 }];
      db.query.mockResolvedValueOnce({ rows: mockRooms });

      const res = await request(app).get('/available-rooms');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockRooms);
    });

    it('should return a server error if database fails', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app).get('/available-rooms');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // =========================
  // Check Guest's Order Status Tests
  // =========================
  describe('GET /check-order/:guestEmail', () => {
    it('should return order status', async () => {
      const guestEmail = 'testuser@example.com';
      const mockOrders = [
        { order_id: 1, status: 'Pending', item_name: 'Pizza', total_price: 20 },
      ];
      db.query.mockResolvedValueOnce({ rows: mockOrders });

      const res = await request(app).get(`/check-order/${guestEmail}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockOrders);
    });

    it('should return an error if no orders are found', async () => {
      const guestEmail = 'nonexistent@example.com';
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get(`/check-order/${guestEmail}`);

      expect(res.status).toBe(404);
      expect(res.body.message).toBe('No orders found for guest.');
    });
  });

  // =========================
  // Place Food Order Tests
  // =========================
  describe('POST /place-order', () => {
    it('should place a food order', async () => {
      const orderData = {
        guestEmail: 'testuser@example.com',
        orderItems: [{ name: 'Pizza', price: 20, quantity: 2 }],
      };
      db.query.mockResolvedValueOnce({});

      const res = await request(app)
        .post('/place-order')
        .send(orderData);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Order placed successfully!');
    });

    it('should return an error if no order items are provided', async () => {
      const orderData = {
        guestEmail: 'testuser@example.com',
        orderItems: [],
      };

      const res = await request(app)
        .post('/place-order')
        .send(orderData);

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Invalid order request.');
    });
  });

  // =========================
  // Check-in Tests
  // =========================
  describe('POST /checkin', () => {
    it('should check in successfully', async () => {
      db.query.mockResolvedValueOnce({}); // simulate successful check-in DB query
      const res = await request(app)
        .post('/checkin')
        .send({ guestEmail: 'testuser@example.com', checkinDate: '2025-05-01' });
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Check-in successful');
    });

    it('should return error if check-in fails', async () => {
      db.query.mockRejectedValueOnce(new Error('Check-in failed'));
      const res = await request(app)
        .post('/checkin')
        .send({ guestEmail: 'testuser@example.com', checkinDate: '2025-05-01' });
      expect(res.status).toBe(500);
      expect(res.body.message).toBe('Check-in failed');
    });
  });

  // =========================
  // Checkout Tests
  // =========================
  describe('POST /checkout', () => {
    it('should checkout successfully', async () => {
      db.query.mockResolvedValueOnce({});
      const res = await request(app)
        .post('/checkout')
        .send({ guestEmail: 'testuser@example.com' });
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Checkout successful');
    });

    it('should return error if checkout fails', async () => {
      db.query.mockRejectedValueOnce(new Error('Checkout failed'));
      const res = await request(app)
        .post('/checkout')
        .send({ guestEmail: 'testuser@example.com' });
      expect(res.status).toBe(500);
      expect(res.body.message).toBe('Checkout failed');
    });
  });
});

