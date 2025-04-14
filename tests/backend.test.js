const request = require('supertest');
const app = require('../server'); // Ensure your server file is named correctly
const { Pool } = require('pg');
const { mockResponse } = require('mock-express-response'); // Mock response

// Mock PostgreSQL database
jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    query: jest.fn(),
    connect: jest.fn(),
  })),
}));

describe("HotelOnCall Backend Routes", () => {
  let db;

  beforeEach(() => {
    db = new Pool();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // Test for User Registration
  describe("POST /register", () => {
    it("should register a new user", async () => {
      const newUser = {
        email: 'testuser@example.com',
        password: 'password123',
        userType: 'guest',
      };

      db.query.mockResolvedValueOnce({ rows: [] }); // No existing user
      db.query.mockResolvedValueOnce({}); // Insert new user

      const res = await request(app)
        .post('/register')
        .send(newUser);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("User registered successfully!");
    });

    it("should return error if user already exists", async () => {
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
      expect(res.body.message).toBe("User already exists!");
    });
  });

  // Test for User Login
  describe("POST /login", () => {
    it("should login an existing user", async () => {
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
      expect(res.body.message).toBe("Login successful!");
    });

    it("should return error for invalid credentials", async () => {
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
      expect(res.body.message).toBe("Invalid credentials!");
    });
  });

  // Test for Google Authentication
  describe("GET /auth/google/callback", () => {
    it("should redirect to the correct URL after successful Google login", async () => {
      const mockProfile = {
        emails: [{ value: 'testuser@example.com' }],
        id: 'google_id',
      };

      const mockDone = jest.fn();
      const mockPassportAuthenticate = jest.fn().mockImplementationOnce(() => mockDone(null, mockProfile));

      app.use((req, res, next) => {
        req.user = { email: 'testuser@example.com', userType: 'guest' }; // Mock user info
        next();
      });

      const res = await request(app)
        .get('/auth/google/callback')
        .query({ success: 'true' });

      expect(res.status).toBe(302);
      expect(res.header.location).toContain('/guest_services.html');
    });
  });

  // Test for Google Prediction API
  describe("GET /api/guest-prediction", () => {
    it("should return guest prediction data", async () => {
      const mockPredictionData = { prediction: "high" };
      axios.get = jest.fn().mockResolvedValueOnce({ data: mockPredictionData });

      const res = await request(app).get('/api/guest-prediction?date=2025-05-01');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockPredictionData);
    });

    it("should return an error for missing date parameter", async () => {
      const res = await request(app).get('/api/guest-prediction');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Date parameter is required (YYYY-MM-DD)');
    });
  });

  // Test for Available Rooms
  describe("GET /available-rooms", () => {
    it("should return available rooms", async () => {
      const mockRooms = [{ room_number: 101 }, { room_number: 102 }];
      db.query.mockResolvedValueOnce({ rows: mockRooms });

      const res = await request(app).get('/available-rooms');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockRooms);
    });

    it("should return a server error if database fails", async () => {
      db.query.mockRejectedValueOnce(new Error("Database error"));

      const res = await request(app).get('/available-rooms');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // Test for Check Guest's Order Status
  describe("GET /check-order/:guestEmail", () => {
    it("should return order status", async () => {
      const guestEmail = 'testuser@example.com';
      const mockOrders = [
        { order_id: 1, status: 'Pending', item_name: 'Pizza', total_price: 20 },
      ];
      db.query.mockResolvedValueOnce({ rows: mockOrders });

      const res = await request(app).get(`/check-order/${guestEmail}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockOrders);
    });

    it("should return an error if no orders are found", async () => {
      const guestEmail = 'nonexistent@example.com';
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get(`/check-order/${guestEmail}`);

      expect(res.status).toBe(404);
      expect(res.body.message).toBe("No orders found for guest.");
    });
  });

  // Test for Place Food Order
  describe("POST /place-order", () => {
    it("should place a food order", async () => {
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
      expect(res.body.message).toBe("Order placed successfully!");
    });

    it("should return an error if no order items are provided", async () => {
      const orderData = {
        guestEmail: 'testuser@example.com',
        orderItems: [],
      };

      const res = await request(app)
        .post('/place-order')
        .send(orderData);

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Invalid order request.");
    });
  });
});

// Test for User Registration
describe("POST /register", () => {
  it("should register a new user", async () => {
    const newUser = { email: 'testuser@example.com', password: 'password123', userType: 'guest' };
    db.query.mockResolvedValueOnce({ rows: [] }); // No existing user
    db.query.mockResolvedValueOnce({});
    const res = await request(app).post('/register').send(newUser);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe("User registered successfully!");
  });

  it("should return error if user already exists", async () => {
    const newUser = { email: 'existinguser@example.com', password: 'password123', userType: 'guest' };
    db.query.mockResolvedValueOnce({ rows: [{ email: 'existinguser@example.com' }] }); // Existing user
    const res = await request(app).post('/register').send(newUser);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("User already exists!");
  });
});

// Test for User Login
describe("POST /login", () => {
  it("should login an existing user", async () => {
    const user = { email: 'testuser@example.com', password: 'password123', userType: 'guest' };
    db.query.mockResolvedValueOnce({ rows: [{ email: 'testuser@example.com', password: 'hashedPassword', userType: 'guest' }] });
    const res = await request(app).post('/login').send(user);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe("Login successful!");
  });

  it("should return error for invalid credentials", async () => {
    const user = { email: 'testuser@example.com', password: 'wrongpassword', userType: 'guest' };
    db.query.mockResolvedValueOnce({ rows: [{ email: 'testuser@example.com', password: 'hashedPassword', userType: 'guest' }] });
    const res = await request(app).post('/login').send(user);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("Invalid credentials!");
  });
});

// Test for Google Authentication
describe("GET /auth/google/callback", () => {
  it("should redirect to the correct URL after successful Google login", async () => {
    const mockProfile = { emails: [{ value: 'testuser@example.com' }], id: 'google_id' };
    const mockDone = jest.fn();
    const mockPassportAuthenticate = jest.fn().mockImplementationOnce(() => mockDone(null, mockProfile));
    app.use((req, res, next) => { req.user = { email: 'testuser@example.com', userType: 'guest' }; next(); });
    const res = await request(app).get('/auth/google/callback').query({ success: 'true' });
    expect(res.status).toBe(302);
    expect(res.header.location).toContain('/guest_services.html');
  });
});

// Test for Google Prediction API
describe("GET /api/guest-prediction", () => {
  it("should return guest prediction data", async () => {
    const mockPredictionData = { prediction: "high" };
    axios.get = jest.fn().mockResolvedValueOnce({ data: mockPredictionData });
    const res = await request(app).get('/api/guest-prediction?date=2025-05-01');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockPredictionData);
  });

  it("should return an error for missing date parameter", async () => {
    const res = await request(app).get('/api/guest-prediction');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Date parameter is required (YYYY-MM-DD)');
  });
});

// Test for Available Rooms
describe("GET /available-rooms", () => {
  it("should return available rooms", async () => {
    const mockRooms = [{ room_number: 101 }, { room_number: 102 }];
    db.query.mockResolvedValueOnce({ rows: mockRooms });
    const res = await request(app).get('/available-rooms');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockRooms);
  });

  it("should return a server error if database fails", async () => {
    db.query.mockRejectedValueOnce(new Error("Database error"));
    const res = await request(app).get('/available-rooms');
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

// Test for Check Guest's Order Status
describe("GET /check-order/:guestEmail", () => {
  it("should return order status", async () => {
    const guestEmail = 'testuser@example.com';
    const mockOrders = [{ order_id: 1, status: 'Pending', item_name: 'Pizza', total_price: 20 }];
    db.query.mockResolvedValueOnce({ rows: mockOrders });
    const res = await request(app).get(`/check-order/${guestEmail}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockOrders);
  });

  it("should return an error if no orders are found", async () => {
    const guestEmail = 'nonexistent@example.com';
    db.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get(`/check-order/${guestEmail}`);
    expect(res.status).toBe(404);
    expect(res.body.message).toBe("No orders found for guest.");
  });
});

// Test for Place Food Order
describe("POST /place-order", () => {
  it("should place a food order", async () => {
    const orderData = { guestEmail: 'testuser@example.com', orderItems: [{ name: 'Pizza', price: 20, quantity: 2 }] };
    db.query.mockResolvedValueOnce({});
    const res = await request(app).post('/place-order').send(orderData);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe("Order placed successfully!");
  });

  it("should return an error if no order items are provided", async () => {
    const orderData = { guestEmail: 'testuser@example.com', orderItems: [] };
    const res = await request(app).post('/place-order').send(orderData);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Invalid order request.");
  });
});
