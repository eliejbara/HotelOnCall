const request = require('supertest');
const app = require('../server'); // Adjust path if needed
const db = require('../db'); // Adjust path to your db.js
const axios = require('axios');
const passport = require('passport');
const nodemailer = require('nodemailer');

// ========================
// Mocks
// ========================
jest.mock('axios');
jest.mock('passport');
jest.mock('passport-google-oauth20', () => {
  return {
    Strategy: jest.fn(),
  };
});
jest.mock('../db');
jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue(true),
  }),
}));

// ========================
// Guest Routes
// ========================
describe('POST /checkin', () => {
  it('should check in guest and send confirmation email', async () => {
    db.query.mockResolvedValue({}); // Mock DB insert
    const res = await request(app)
      .post('/checkin')
      .send({
        email: 'testuser@example.com',
        username: 'Test User',
        roomNumber: 123,
      });
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Check-in successful');
  });
});

describe('POST /place-order', () => {
  it('should place food order', async () => {
    db.query.mockResolvedValueOnce({});
    const res = await request(app)
      .post('/place-order')
      .send({
        guestEmail: 'testuser@example.com',
        itemId: 1,
        itemName: 'Pizza',
      });
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Order placed');
  });
});

describe('GET /check-order', () => {
  it('should return order status', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ item_name: 'Pizza', status: 'Pending' }],
    });
    const res = await request(app).get('/check-order?email=testuser@example.com');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ item_name: 'Pizza', status: 'Pending' }]);
  });
});

// ========================
// Maintenance Routes
// ========================
describe('POST /request-maintenance', () => {
  it('should request maintenance successfully', async () => {
    db.query.mockResolvedValueOnce({});
    const res = await request(app)
      .post('/request-maintenance')
      .send({ guestEmail: 'testuser@example.com', issue: 'Leaky faucet' });
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Maintenance request submitted');
  });

  it('should return error if request fails', async () => {
    db.query.mockRejectedValueOnce(new Error('Maintenance insert failed'));
    const res = await request(app)
      .post('/request-maintenance')
      .send({ guestEmail: 'testuser@example.com', issue: 'Broken light' });
    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Failed to request maintenance');
  });
});

describe('GET /guest-maintenance', () => {
  it('should get maintenance status for guest', async () => {
    const mockRequests = [{ id: 1, issue: 'Leaky faucet', status: 'Pending' }];
    db.query.mockResolvedValueOnce({ rows: mockRequests });
    const res = await request(app).get('/guest-maintenance?email=testuser@example.com');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockRequests);
  });
});

describe('POST /update-maintenance-status', () => {
  it('should update maintenance status and send email', async () => {
    db.query.mockResolvedValueOnce({});
    const res = await request(app)
      .post('/update-maintenance-status')
      .send({ id: 1, status: 'Completed', guestEmail: 'testuser@example.com' });
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Maintenance status updated');
  });
});

// ========================
// Cleaning Routes
// ========================
describe('POST /request-cleaning', () => {
  it('should request cleaning successfully', async () => {
    db.query.mockResolvedValueOnce({});
    const res = await request(app)
      .post('/request-cleaning')
      .send({ guestEmail: 'testuser@example.com' });
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Cleaning request submitted');
  });
});

describe('GET /cleaning-requests', () => {
  it('should return pending cleaning requests', async () => {
    const mockCleaning = [{ id: 1, guest_email: 'testuser@example.com', status: 'Pending' }];
    db.query.mockResolvedValueOnce({ rows: mockCleaning });
    const res = await request(app).get('/cleaning-requests');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockCleaning);
  });
});

describe('POST /update-cleaning-status', () => {
  it('should update cleaning status and notify guest', async () => {
    db.query.mockResolvedValueOnce({});
    const res = await request(app)
      .post('/update-cleaning-status')
      .send({ id: 1, status: 'Completed', guestEmail: 'testuser@example.com' });
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Cleaning status updated');
  });
});

// ========================
// Role Selection
// ========================
describe('POST /select-role', () => {
  it('should select a valid role', async () => {
    const res = await request(app)
      .post('/select-role')
      .send({ role: 'cook' });
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Role selected');
  });

  it('should return error for invalid role', async () => {
    const res = await request(app)
      .post('/select-role')
      .send({ role: 'invalidrole' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Invalid role selected');
  });
});

// ========================
// Cook Dashboard
// ========================
describe('GET /cook/orders', () => {
  it('should return pending food orders', async () => {
    const mockOrders = [{ order_id: 1, username: 'John', item_name: 'Pizza' }];
    db.query.mockResolvedValueOnce({ rows: mockOrders });
    const res = await request(app).get('/cook/orders');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockOrders);
  });
});

describe('POST /cook/update-order', () => {
  it('should update food order status and notify guest', async () => {
    db.query.mockResolvedValueOnce({});
    const res = await request(app)
      .post('/cook/update-order')
      .send({ orderId: 1, status: 'Completed', guestEmail: 'testuser@example.com' });
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Order status updated');
  });
});
