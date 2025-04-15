const request = require('supertest');
const express = require('express');
const session = require('express-session');
const passport = require('passport');

jest.mock('../db', () => {
  const mClient = {
    query: jest.fn(),
    connect: jest.fn().mockResolvedValue({
      release: jest.fn(),
    }),
  };
  return { pool: mClient, client: mClient };
});

jest.mock('passport-google-oauth20', () => {
  return {
    Strategy: jest.fn().mockImplementation(() => ({
      name: 'google',
      authenticate: jest.fn(),
    })),
  };
});
jest.mock('passport', () => ({
  initialize: jest.fn(() => (req, res, next) => next()),
  session: jest.fn(() => (req, res, next) => next()),
  authenticate: jest.fn(() => (req, res, next) => next()),
  use: jest.fn(),
  serializeUser: jest.fn(),
  deserializeUser: jest.fn(),
}));


const app = require('../server'); // Import AFTER mocks

describe('HotelOnCall Backend API', () => {
  test('GET /menu - should return menu items', async () => {
    const res = await request(app).get('/menu');
    expect(res.statusCode).toBe(200);
  });

  test('POST /checkin - should check in guest', async () => {
    const res = await request(app).post('/checkin').send({
      name: 'John Doe',
      email: 'john@example.com',
      room_number: 101,
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('POST /place-order - should place a food order', async () => {
    const res = await request(app).post('/place-order').send({
      guestEmail: 'john@example.com',
      order: 'Pizza',
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('GET /check-order - should return guest orders', async () => {
    const res = await request(app).get('/check-order').query({
      guestEmail: 'john@example.com',
    });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('GET /cook/orders - should return all food orders', async () => {
    const res = await request(app).get('/cook/orders');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('POST /cook/update-order - should update food order status', async () => {
    const res = await request(app).post('/cook/update-order').send({
      orderId: 1,
      status: 'Completed',
    });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      success: true,
      message: 'Order updated to Completed',
    });
  });

  test('POST /request-maintenance - should request maintenance', async () => {
    const res = await request(app).post('/request-maintenance').send({
      guestEmail: 'john@example.com',
      issue: 'Air conditioner not working',
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('GET /guest-maintenance - should return guest maintenance requests', async () => {
    const res = await request(app).get('/guest-maintenance').query({
      guestEmail: 'john@example.com',
    });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('GET /maintenance-requests - should return all maintenance requests', async () => {
    const res = await request(app).get('/maintenance-requests');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('POST /update-maintenance-status - should update maintenance status', async () => {
    const res = await request(app).post('/update-maintenance-status').send({
      requestId: 1,
      status: 'Resolved',
    });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      success: true,
      message: 'Request updated to Resolved',
    });
  });

  test('POST /request-cleaning - should request cleaning', async () => {
    const res = await request(app).post('/request-cleaning').send({
      guestEmail: 'john@example.com',
      time: '10:00 AM',
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('GET /guest-room - should return guest room info', async () => {
    const res = await request(app).get('/guest-room').query({
      guestEmail: 'john@example.com',
    });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ room_number: 101 });
  });
});
