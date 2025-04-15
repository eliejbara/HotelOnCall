jest.mock('passport', () => {
  const passport = {
    initialize: jest.fn(() => (req, res, next) => next()),
    session: jest.fn(() => (req, res, next) => next()),
    authenticate: jest.fn(() => (req, res, next) => next()),
    use: jest.fn(),
    serializeUser: jest.fn(),
    deserializeUser: jest.fn()
  };
  passport.GoogleStrategy = jest.fn();
  return passport;
});

const mockClient = {
  query: jest.fn(),
  release: jest.fn()
};

jest.mock('pg', () => {
  return {
    Pool: jest.fn(() => ({
      connect: jest.fn().mockResolvedValue(mockClient)
    }))
  };
});

jest.mock('passport-google-oauth20', () => {
  return {
    Strategy: jest.fn().mockImplementation(() => {
      return { name: 'mock-google' };
    })
  };
});

const request = require('supertest');
const app = require('../server');

describe('HotelOnCall Backend API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

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

  test('GET /available-rooms - should return list of available rooms', async () => {
    mockClient.query.mockResolvedValueOnce({
      rows: [{ id: 1, number: 101, status: 'available' }]
    });

    const res = await request(app).get('/available-rooms');
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([{ id: 1, number: 101, status: 'available' }]);
  });

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

  test('POST /place-order - should place food order', async () => {
    mockClient.query.mockResolvedValueOnce({}); // insert order

    const res = await request(app)
      .post('/place-order')
      .send({ guestEmail: 'john@example.com', foodOrder: 'Burger' });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ message: 'Order placed successfully.' });
  });

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

  test('POST /request-maintenance - should submit maintenance request', async () => {
    mockClient.query.mockResolvedValueOnce({}); // insert request

    const res = await request(app)
      .post('/request-maintenance')
      .send({ roomNumber: 101, issueType: 'AC', guestEmail: 'guest@example.com', details: 'Not working properly' });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true, message: 'Maintenance request submitted successfully!' });
  });

  test('GET /guest-maintenance - should return maintenance requests for guest', async () => {
    mockClient.query.mockResolvedValueOnce({
      rows: [{ id: 1, issue_type: 'AC', status: 'pending' }]
    });

    const res = await request(app)
      .get('/guest-maintenance/guest@example.com');

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([
      { id: 1, issue_type: 'AC', status: 'pending' }
    ]);
  });

 describe('GET /maintenance-requests', () => {
  test('should return pending maintenance requests', async () => {
    mockClient.query.mockResolvedValueOnce({
      rows: [
        {
          id: 1,
          room_number: 101,
          issue_type: 'AC',
          guest_email: 'guest@example.com',
          status: 'pending'
        }
      ]
    });

    const res = await request(app).get('/maintenance-requests');
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([
      {
        id: 1,
        room_number: 101,
        issue_type: 'AC',
        guest_email: 'guest@example.com',
        status: 'pending'
      }
    ]);
  });
});

 describe('POST /update-maintenance-status', () => {
  test('should update maintenance status', async () => {
    mockClient.query.mockResolvedValueOnce({ rowCount: 1 });

    const res = await request(app)
      .post('/update-maintenance-status')
      .send({ requestId: 1, status: 'Resolved' });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true, message: 'Request updated to Resolved' });
  });
});
 describe('GET /guest-room', () => {
  test('should return guest room info', async () => {
    mockClient.query.mockResolvedValueOnce({
      rows: [{ room_number: 101 }]
    });

    const res = await request(app).get('/guest-room').query({ guestEmail: 'john@example.com' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ room_number: 101 });
  });
});
