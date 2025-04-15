const request = require('supertest');
const express = require('express');
const session = require('express-session');
const mockDb = require('../db'); // This is mocked below
jest.mock('../db');

jest.mock('passport-google-oauth20', () => {
  return {
    Strategy: jest.fn().mockImplementation((options, verify) => {
      this.name = 'google';
      this.authenticate = jest.fn();
      this.verify = verify;
    }),
  };
});

beforeAll(() => {
  process.env.GOOGLE_CLIENT_ID = 'mock-client-id';
  process.env.GOOGLE_CLIENT_SECRET = 'mock-client-secret';
});

afterAll(() => {
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;
});

beforeEach(() => {
  jest.clearAllMocks();
});

const app = require('../server'); // Assuming your app is exported from server.js

describe('HotelOnCall Backend API', () => {
  // Global DB mock
  mockDb.query.mockImplementation((sql, params) => {
    if (sql.includes('SELECT * FROM guests WHERE email')) {
      return Promise.resolve({ rows: [{ room_number: 101 }] });
    }
    if (sql.includes('SELECT * FROM cleaning_slots WHERE room_number')) {
      return Promise.resolve({
        rows: [{
          id: 1,
          room_number: 101,
          date: '2025-04-20',
          time: '10:00 AM',
          available: true
        }]
      });
    }
    if (sql.includes('INSERT INTO cleaning_requests')) {
      return Promise.resolve({ rowCount: 1 });
    }
    if (sql.includes('UPDATE cleaning_requests')) {
      return Promise.resolve({ rowCount: 1 });
    }
    if (sql.includes('SELECT email FROM guests WHERE room_number')) {
      return Promise.resolve({ rows: [{ email: 'john@example.com' }] });
    }
    if (sql.includes('SELECT room_number FROM guests WHERE email')) {
      return Promise.resolve({ rows: [{ room_number: 101 }] });
    }
    if (sql.includes('SELECT * FROM cleaning_requests WHERE guest_email')) {
      return Promise.resolve({ rows: [{ id: 1, guest_email: 'john@example.com', status: 'Pending' }] });
    }
    if (sql.includes('SELECT * FROM cleaning_requests WHERE status')) {
      return Promise.resolve({ rows: [{ id: 1, room_number: 101, date: '2025-04-20', time: '10:00 AM', status: 'Pending' }] });
    }
    if (sql.includes('INSERT INTO orders')) {
      return Promise.resolve({ rowCount: 1 });
    }
    if (sql.includes('UPDATE orders')) {
      return Promise.resolve({ rowCount: 1 });
    }
    if (sql.includes('SELECT * FROM orders WHERE order_id')) {
      return Promise.resolve({ rows: [{ order_id: 1, status: 'Pending' }] });
    }
    if (sql.includes('SELECT * FROM maintenance_requests')) {
      return Promise.resolve({ rows: [{ id: 1, guest_email: 'john@example.com', status: 'Pending' }] });
    }
    return Promise.resolve({ rows: [] });
  });

  it('POST /request-cleaning - should request cleaning', async () => {
    const res = await request(app)
      .post('/request-cleaning')
      .send({
        guestEmail: 'john@example.com',
        date: '2025-04-20',
        time: '10:00 AM'
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('POST /update-cleaning-status - should update status and send email', async () => {
    const res = await request(app)
      .post('/update-cleaning-status')
      .send({
        id: 1,
        status: 'Resolved',
        room_number: 101
      });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      success: true,
      message: 'Request updated to Resolved'
    });
  });

  it('GET /guest-room - should return guest room info', async () => {
    const res = await request(app)
      .get('/guest-room')
      .query({
        guestEmail: 'john@example.com'
      });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ room_number: 101 });
  });

  it('GET /guest-cleaning - should return cleaning request status', async () => {
    const res = await request(app)
      .get('/guest-cleaning')
      .query({ guestEmail: 'john@example.com' });

    expect(res.statusCode).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('GET /cleaning-requests - should return all pending cleaning requests', async () => {
    const res = await request(app)
      .get('/cleaning-requests');

    expect(res.statusCode).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('POST /place-order - should place an order', async () => {
    const res = await request(app)
      .post('/place-order')
      .send({
        guestEmail: 'john@example.com',
        foodItem: 'Pizza',
        quantity: 1
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('GET /cook/orders - should get all cook orders', async () => {
    const res = await request(app)
      .get('/cook/orders');

    expect(res.statusCode).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('POST /cook/update-order - should update order status', async () => {
    const res = await request(app)
      .post('/cook/update-order')
      .send({
        orderId: 1,
        status: 'Completed'
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('GET /maintenance-requests - should get all maintenance requests', async () => {
    const res = await request(app)
      .get('/maintenance-requests');

    expect(res.statusCode).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('POST /maintenance-requests - should request maintenance', async () => {
    const res = await request(app)
      .post('/maintenance-requests')
      .send({
        guestEmail: 'john@example.com',
        issue: 'Air conditioner broken'
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('POST /update-maintenance-status - should update maintenance status', async () => {
    const res = await request(app)
      .post('/update-maintenance-status')
      .send({
        id: 1,
        status: 'Resolved'
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('POST /checkin - should check in a guest', async () => {
    const res = await request(app)
      .post('/checkin')
      .send({
        guestEmail: 'john@example.com',
        roomNumber: 101
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('POST /checkout - should check out a guest and clear data', async () => {
    const res = await request(app)
      .post('/checkout')
      .send({
        guestEmail: 'john@example.com'
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
