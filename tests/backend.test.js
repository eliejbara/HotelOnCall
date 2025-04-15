// tests/backend.test.js
const request = require('supertest');
const app = require('../server');
const db = require('../db'); // Your db file where you export pool/client

jest.mock('../db', () => {
  const mClient = {
    query: jest.fn(),
    connect: jest.fn().mockResolvedValue({
      release: jest.fn()
    })
  };
  return {
    client: mClient,
    pool: {
      connect: jest.fn().mockResolvedValue(mClient),
      query: mClient.query
    }
  };
});

const mockClient = db.client;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('HotelOnCall Backend API', () => {

  test('POST /checkin - should check in a guest', async () => {
    mockClient.query.mockResolvedValueOnce({ rowCount: 1 });

    const res = await request(app).post('/checkin').send({
      name: 'John Doe',
      email: 'john@example.com',
      room_number: 101
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true, message: 'Check-in successful' });
  });

  test('POST /place-order - should place a food order', async () => {
    mockClient.query.mockResolvedValueOnce({ rowCount: 1 });

    const res = await request(app).post('/place-order').send({
      guestEmail: 'john@example.com',
      foodItems: ['Pizza', 'Burger']
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true, message: 'Order placed successfully' });
  });

  test('GET /check-order - should return guest orders', async () => {
    mockClient.query.mockResolvedValueOnce({
      rows: [
        {
          id: 1,
          guest_email: 'john@example.com',
          food_items: ['Pizza'],
          status: 'Pending'
        }
      ]
    });

    const res = await request(app).get('/check-order').query({ guestEmail: 'john@example.com' });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([
      {
        id: 1,
        guest_email: 'john@example.com',
        food_items: ['Pizza'],
        status: 'Pending'
      }
    ]);
  });

  test('GET /cook/orders - should return all food orders', async () => {
    mockClient.query.mockResolvedValueOnce({
      rows: [
        {
          id: 1,
          guest_email: 'john@example.com',
          food_items: ['Pizza'],
          status: 'Pending'
        }
      ]
    });

    const res = await request(app).get('/cook/orders');
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([
      {
        id: 1,
        guest_email: 'john@example.com',
        food_items: ['Pizza'],
        status: 'Pending'
      }
    ]);
  });

  test('POST /cook/update-order - should update order status', async () => {
    mockClient.query.mockResolvedValueOnce({ rowCount: 1 });

    const res = await request(app).post('/cook/update-order').send({
      orderId: 1,
      status: 'Completed'
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true, message: 'Order updated to Completed' });
  });

  test('POST /request-maintenance - should submit maintenance request', async () => {
    mockClient.query.mockResolvedValueOnce({ rowCount: 1 });

    const res = await request(app).post('/request-maintenance').send({
      guestEmail: 'john@example.com',
      issue: 'AC not working'
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true, message: 'Maintenance request submitted' });
  });

  test('GET /guest-maintenance - should return guest maintenance requests', async () => {
    mockClient.query.mockResolvedValueOnce({
      rows: [
        {
          id: 1,
          guest_email: 'john@example.com',
          issue: 'AC not working',
          status: 'Pending'
        }
      ]
    });

    const res = await request(app).get('/guest-maintenance').query({ guestEmail: 'john@example.com' });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([
      {
        id: 1,
        guest_email: 'john@example.com',
        issue: 'AC not working',
        status: 'Pending'
      }
    ]);
  });

  test('GET /maintenance-requests - should return all maintenance requests', async () => {
    mockClient.query.mockResolvedValueOnce({
      rows: [
        {
          id: 1,
          guest_email: 'john@example.com',
          issue: 'AC not working',
          status: 'Pending'
        }
      ]
    });

    const res = await request(app).get('/maintenance-requests');
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([
      {
        id: 1,
        guest_email: 'john@example.com',
        issue: 'AC not working',
        status: 'Pending'
      }
    ]);
  });

  test('POST /update-maintenance-status - should update maintenance status', async () => {
    mockClient.query.mockResolvedValueOnce({ rowCount: 1 });

    const res = await request(app).post('/update-maintenance-status').send({
      requestId: 1,
      status: 'Resolved'
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true, message: 'Request updated to Resolved' });
  });

  test('GET /guest-room - should return guest room info', async () => {
    mockClient.query.mockResolvedValueOnce({
      rows: [{ room_number: 101 }]
    });

    const res = await request(app).get('/guest-room').query({ guestEmail: 'john@example.com' });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ room_number: 101 });
  });

  test('POST /checkout - should checkout guest and clean data', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rowCount: 1 }) // delete food orders
      .mockResolvedValueOnce({ rowCount: 1 }) // delete maintenance
      .mockResolvedValueOnce({ rowCount: 1 }) // delete cleaning
      .mockResolvedValueOnce({ rowCount: 1 }); // delete guest

    const res = await request(app).post('/checkout').send({ guestEmail: 'john@example.com' });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true, message: 'Checkout complete' });
  });

});
