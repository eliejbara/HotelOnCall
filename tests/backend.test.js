const request = require('supertest');

// Live URL for your Vercel deployment
const app = 'https://hotel-on-call.vercel.app';

describe('HotelOnCall Backend API', () => {

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
