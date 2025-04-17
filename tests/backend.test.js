const request = require('supertest');

const app = process.env.BACKEND_URL;
if (!app) throw new Error('BACKEND_URL is not defined in environment variables');
jest.setTimeout(10000); // 10 seconds timeout for this test

describe('HotelOnCall Backend API', () => {
  let cleaningId;
  let maintenanceId;
  let orderId;

  // Test for checking in a guest
  it('POST /checkin should check in a guest', async () => {
    const res = await request(app).post('/checkin').send({
      guestEmail: 'john@example.com',
      roomNumber: 101
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.roomNumber).toBe(101);
  });

  // Test for placing a food order
  it('POST /place-order should create a food order', async () => {
    const res = await request(app).post('/place-order').send({
      guestEmail: 'john@example.com',
      foodItem: 'Pizza',
      quantity: 1
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.orderId).toBeDefined();
    orderId = res.body.orderId; // Store orderId for future use
  });

  // Test for fetching cook orders
  it('GET /cook/orders should return a list of orders for cooks', async () => {
    const res = await request(app).get('/cook/orders');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  // Test for updating the status of an order
  it('POST /update-order-status should update the status of an order', async () => {
    const res = await request(app).post('/update-order-status').send({
      orderId,
      status: 'Completed'
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  // Test for fetching guest room details
  it('GET /guest-room/:guestEmail should return guest room details', async () => {
    const res = await request(app).get('/guest-room/john@example.com');
    expect(res.statusCode).toBe(200);
    expect(res.body.roomNumber).toBe(101);
  });

  // Test for fetching available cleaning slots for a room
  it('GET /available-cleaning-slots should return available cleaning slots for a room', async () => {
    const res = await request(app).get('/available-cleaning-slots').query({ room_number: 101 });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  // Test for requesting cleaning
  it('POST /request-cleaning should request cleaning for a room', async () => {
    const res = await request(app).post('/request-cleaning').send({
      guestEmail: 'john@example.com',
      date: '2025-04-20',
      time: '10:00 AM'
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  // Test for fetching guest cleaning requests
  it('GET /guest-cleaning/:guestEmail should return guest cleaning requests', async () => {
    const res = await request(app).get('/guest-cleaning/john@example.com');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    cleaningId = res.body[0].id; // Store cleaningId for future use
  });

  // Test for updating the cleaning status
  it('POST /update-cleaning-status should update the cleaning status', async () => {
    const res = await request(app).post('/update-cleaning-status').send({
      id: cleaningId,
      status: 'Resolved',
      room_number: 101
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  // Test for fetching all cleaning requests
  it('GET /cleaning-requests should return a list of cleaning requests', async () => {
    const res = await request(app).get('/cleaning-requests');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  // Test for requesting maintenance
  it('POST /request-maintenance should request maintenance for a room', async () => {
    const res = await request(app).post('/request-maintenance').send({
      guestEmail: 'john@example.com',
      issue: 'Air conditioner broken'
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  // Test for fetching guest maintenance requests
  it('GET /guest-maintenance/:guestEmail should return guest maintenance requests', async () => {
    const res = await request(app).get('/guest-maintenance/john@example.com');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    maintenanceId = res.body[0].id; // Store maintenanceId for future use
  });

  // Test for fetching all maintenance requests
  it('GET /maintenance-requests should return a list of maintenance requests', async () => {
    const res = await request(app).get('/maintenance-requests');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  // Test for updating the maintenance status
  it('POST /update-maintenance-status should update the maintenance status', async () => {
    const res = await request(app).post('/update-maintenance-status').send({
      id: maintenanceId,
      status: 'Resolved'
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  // Test for calculating the room bill
  it('GET /calculate-bill/:roomNumber should return the total bill for a room', async () => {
    const res = await request(app).get('/calculate-bill/101');
    expect(res.statusCode).toBe(200);
    expect(res.body.totalBill).toBeDefined();
  });

  // Test for creating a checkout session
  it('POST /create-checkout-session should create a checkout session', async () => {
    const res = await request(app).post('/create-checkout-session').send({
      roomNumber: 101
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.url).toBeDefined();
  });

  // Test for finalizing the checkout
  it('POST /finalize-checkout should finalize the checkout process', async () => {
    const res = await request(app).post('/finalize-checkout').send({
      guestEmail: 'john@example.com'
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  // Test for completing the checkout
  it('POST /checkout should complete checkout', async () => {
    const res = await request(app).post('/checkout').send({
      guestEmail: 'john@example.com'
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
