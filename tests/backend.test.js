const request = require('supertest');

const app = process.env.BACKEND_URL;
if (!app) throw new Error('BACKEND_URL is not defined in environment variables');

describe('HotelOnCall Backend API', () => {
  let cleaningId;
  let maintenanceId;
  let orderId;
  const guestEmail = 'john@example.com';
  const roomNumber = 101;
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  it('POST /checkin', async () => {
    const res = await request(app).post('/checkin').send({
      guestEmail,
      roomNumber
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.roomNumber).toBe(roomNumber);
  });

  it('POST /place-order', async () => {
    const res = await request(app).post('/place-order').send({
      guestEmail,
      foodItem: 'Pizza',
      quantity: 1
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.orderId).toBeDefined();
    orderId = res.body.orderId;
  });

  it('GET /cook/orders', async () => {
    const res = await request(app).get('/cook/orders');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('POST /update-order-status', async () => {
    const res = await request(app).post('/update-order-status').send({
      orderId,
      status: 'Completed'
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('GET /guest-room/:guestEmail', async () => {
    const res = await request(app).get(`/guest-room/${guestEmail}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.room_number).toBe(roomNumber);
  });

  it('GET /available-cleaning-slots', async () => {
    const res = await request(app)
      .get('/available-cleaning-slots')
      .query({ room_number: roomNumber });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('POST /request-cleaning', async () => {
    const res = await request(app).post('/request-cleaning').send({
      guestEmail,
      date: today,
      time: '10:00 AM'
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('GET /guest-cleaning/:guestEmail', async () => {
    const res = await request(app).get(`/guest-cleaning/${guestEmail}`);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    cleaningId = res.body[0].id;
  });

  it('POST /update-cleaning-status', async () => {
    const res = await request(app).post('/update-cleaning-status').send({
      id: cleaningId,
      status: 'Resolved',
      room_number: roomNumber
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('GET /cleaning-requests', async () => {
    const res = await request(app).get('/cleaning-requests');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST /request-maintenance', async () => {
    const res = await request(app).post('/request-maintenance').send({
      guestEmail,
      issue: 'Air conditioner broken'
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('GET /guest-maintenance/:guestEmail', async () => {
    const res = await request(app).get(`/guest-maintenance/${guestEmail}`);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    maintenanceId = res.body[0].id;
  });

  it('GET /maintenance-requests', async () => {
    const res = await request(app).get('/maintenance-requests');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST /update-maintenance-status', async () => {
    const res = await request(app).post('/update-maintenance-status').send({
      id: maintenanceId,
      status: 'Resolved'
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('GET /calculate-bill/:roomNumber', async () => {
    const res = await request(app).get(`/calculate-bill/${roomNumber}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.totalBill).toBeDefined();
  });

  it('POST /create-checkout-session', async () => {
    const res = await request(app).post('/create-checkout-session').send({
      roomNumber
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.url).toBeDefined();
  });

  it('POST /finalize-checkout', async () => {
    const res = await request(app).post('/finalize-checkout').send({
      guestEmail
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('POST /checkout', async () => {
    const res = await request(app).post('/checkout').send({
      guestEmail
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
