const request = require('supertest')('https://hotel-on-call.vercel.app');

let orderId;
let cleaningId;
let maintenanceId;

describe('HotelOnCall Backend API', () => {
  beforeAll(async () => {
    // Ensure guest is checked in before running dependent tests
    await request.post('/checkin').send({
      name: 'John Doe',
      email: 'john@example.com',
      roomNumber: 101
    });
  });

  it('POST /checkin should check in a guest', async () => {
    const res = await request.post('/checkin').send({
      name: 'Test Guest',
      email: 'testguest@example.com',
      roomNumber: 102
    });
    expect([200, 400]).toContain(res.statusCode); // Allow for duplicate
  });

  it('POST /place-order should create a food order', async () => {
    const res = await request.post('/place-order').send({
      roomNumber: 101,
      foodItem: 'Burger',
      quantity: 1
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.orderId).toBeDefined();
    orderId = res.body.orderId;
  });

  it('GET /cook/orders should return a list of orders for cooks', async () => {
    const res = await request.get('/cook/orders');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST /update-order-status should update the status of an order', async () => {
    const res = await request.post('/update-order-status').send({
      orderId,
      status: 'Completed'
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('GET /guest-room/:guestEmail should return guest room details', async () => {
    const res = await request.get('/guest-room/john@example.com');
    expect(res.statusCode).toBe(200);
    expect(res.body.roomNumber).toBe(101);
  });

  it('GET /available-cleaning-slots should return available cleaning slots for a room', async () => {
    const res = await request.get('/available-cleaning-slots?roomNumber=101');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST /request-cleaning should request cleaning for a room', async () => {
    const res = await request.post('/request-cleaning').send({
      guestEmail: 'john@example.com',
      roomNumber: 101,
      time: '10:00 AM'
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('GET /guest-cleaning/:guestEmail should return guest cleaning requests', async () => {
    const res = await request.get('/guest-cleaning/john@example.com');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    cleaningId = res.body[0].id;
  });

  it('POST /update-cleaning-status should update the cleaning status', async () => {
    const res = await request.post('/update-cleaning-status').send({
      cleaningId,
      status: 'Completed',
      room_number: 101
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('GET /cleaning-requests should return a list of cleaning requests', async () => {
    const res = await request.get('/cleaning-requests');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST /request-maintenance should request maintenance for a room', async () => {
    const res = await request.post('/request-maintenance').send({
      guestEmail: 'john@example.com',
      roomNumber: 101,
      issue: 'Air conditioner broken'
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('GET /guest-maintenance/:guestEmail should return guest maintenance requests', async () => {
    const res = await request.get('/guest-maintenance/john@example.com');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    maintenanceId = res.body[0].id;
  });

  it('GET /maintenance-requests should return a list of maintenance requests', async () => {
    const res = await request.get('/maintenance-requests');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST /update-maintenance-status should update the maintenance status', async () => {
    const res = await request.post('/update-maintenance-status').send({
      maintenanceId,
      status: 'Resolved'
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('GET /calculate-bill/:roomNumber should return the total bill for a room', async () => {
    const res = await request.get('/calculate-bill/101');
    expect([200, 404]).toContain(res.statusCode);
  });

  it('POST /create-checkout-session should create a checkout session', async () => {
    const res = await request.post('/create-checkout-session').send({
      roomNumber: 101,
      guestEmail: 'john@example.com'
    });
    expect([200, 400]).toContain(res.statusCode); // Allow if already checked out
  });

  it('POST /finalize-checkout should finalize the checkout process', async () => {
    const res = await request.post('/finalize-checkout').send({
      roomNumber: 101,
      guestEmail: 'john@example.com'
    });
    expect([200, 400]).toContain(res.statusCode); // Allow if already finalized
  });

  it('POST /checkout should complete checkout', async () => {
    const res = await request.post('/checkout').send({
      guestEmail: 'john@example.com'
    });
    expect([200, 400]).toContain(res.statusCode); // Allow if already checked out
  });
});
