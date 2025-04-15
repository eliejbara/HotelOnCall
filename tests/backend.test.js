jest.mock('passport', () => {
  const passport = jest.fn(() => ({
    initialize: () => (req, res, next) => next(),
    session: () => (req, res, next) => next(),
    authenticate: () => (req, res, next) => next(),
    use: jest.fn(), // Mocking passport.use()
    serializeUser: jest.fn(),
    deserializeUser: jest.fn()
  }));

  passport.GoogleStrategy = jest.fn(); // Mock GoogleStrategy

  return passport;
});

jest.mock('pg', () => {
  const mClient = {
    query: jest.fn(),
    release: jest.fn()
  };
  const mPool = {
    connect: jest.fn(() => mClient)
  };
  return { Pool: jest.fn(() => mPool) };
});

const request = require('supertest');
const app = require('../server'); // Adjust path if needed
const { Pool } = require('pg');


describe('HotelOnCall Backend API', () => {
  let mockClient;

  beforeEach(() => {
    mockClient = new Pool().connect();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // GET /cook/orders
  test('GET /cook/orders - should return list of orders', async () => {
    mockClient.query.mockResolvedValueOnce({
      rows: [{ id: 1, username: 'john', food_order: 'Pizza', status: 'pending' }]
    });

    const res = await request(app).get('/cook/orders');
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([
      { id: 1, username: 'john', food_order: 'Pizza', status: 'pending' }
    ]);
  });

  // POST /request-cleaning
  test('POST /request-cleaning - should submit cleaning request', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [{ id: 2 }] }) // get available slot
      .mockResolvedValueOnce({}) // insert request
      .mockResolvedValueOnce({}); // update slot

    const res = await request(app)
      .post('/request-cleaning')
      .send({ roomNumber: 101, guestEmail: 'guest@example.com' });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ message: 'Cleaning request submitted successfully.' });
  });

  test('POST /request-cleaning - no available slots', async () => {
    mockClient.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/request-cleaning')
      .send({ roomNumber: 102, guestEmail: 'guest@example.com' });

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'No cleaning slots available' });
  });

  // GET /available-rooms
  test('GET /available-rooms - should return list of available rooms', async () => {
    mockClient.query.mockResolvedValueOnce({
      rows: [{ id: 1, number: 101, status: 'available' }]
    });

    const res = await request(app).get('/available-rooms');
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([{ id: 1, number: 101, status: 'available' }]);
  });

  // POST /checkin
  test('POST /checkin - should check in guest', async () => {
    mockClient.query
      .mockResolvedValueOnce({}) // insert guest
      .mockResolvedValueOnce({}); // update room status

    const res = await request(app)
      .post('/checkin')
      .send({ name: 'John', email: 'john@example.com', roomNumber: 101 });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ message: 'Guest checked in successfully.' });
  });

  // POST /place-order
  test('POST /place-order - should place food order', async () => {
    mockClient.query.mockResolvedValueOnce({}); // insert order

    const res = await request(app)
      .post('/place-order')
      .send({ guestEmail: 'john@example.com', foodOrder: 'Burger' });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ message: 'Order placed successfully.' });
  });

  // GET /check-order
  test('GET /check-order - should return food orders', async () => {
    mockClient.query.mockResolvedValueOnce({
      rows: [{ id: 1, food_order: 'Burger', status: 'pending' }]
    });

    const res = await request(app)
      .get('/check-order')
      .query({ guestEmail: 'john@example.com' });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([
      { id: 1, food_order: 'Burger', status: 'pending' }
    ]);
  });

  // POST /request-maintenance
  test('POST /request-maintenance - should submit maintenance request', async () => {
    mockClient.query.mockResolvedValueOnce({}); // insert request

    const res = await request(app)
      .post('/request-maintenance')
      .send({ roomNumber: 101, issue: 'AC not working', guestEmail: 'guest@example.com' });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ message: 'Maintenance request submitted successfully.' });
  });

  // GET /guest-maintenance
  test('GET /guest-maintenance - should return maintenance requests for guest', async () => {
    mockClient.query.mockResolvedValueOnce({
      rows: [{ id: 1, issue: 'AC not working', status: 'pending' }]
    });

    const res = await request(app)
      .get('/guest-maintenance')
      .query({ guestEmail: 'guest@example.com' });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([
      { id: 1, issue: 'AC not working', status: 'pending' }
    ]);
  });

  // GET /maintenance-requests
  test('GET /maintenance-requests - should return pending maintenance requests', async () => {
    mockClient.query.mockResolvedValueOnce({
      rows: [{ id: 1, room_number: 101, issue: 'AC', guest_email: 'guest@example.com' }]
    });

    const res = await request(app).get('/maintenance-requests');
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([
      { id: 1, room_number: 101, issue: 'AC', guest_email: 'guest@example.com' }
    ]);
  });

  // POST /update-maintenance-status
  test('POST /update-maintenance-status - should update maintenance status', async () => {
    mockClient.query.mockResolvedValueOnce({}); // update query

    const res = await request(app)
      .post('/update-maintenance-status')
      .send({ requestId: 1, status: 'completed', guestEmail: 'guest@example.com' });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ message: 'Maintenance status updated successfully.' });
  });

  // GET /guest-room
  test('GET /guest-room - should return guest room info', async () => {
    mockClient.query.mockResolvedValueOnce({
      rows: [{ room_number: 101 }]
    });

    const res = await request(app)
      .get('/guest-room')
      .query({ guestEmail: 'john@example.com' });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ room_number: 101 });
  });
});
