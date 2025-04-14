const request = require('supertest');
const app = 'https://hotel-on-call.vercel.app'; // Your Vercel-deployed backend URL

const guestData = {
  username: 'guest123',
  roomId: '101',
  checkinDate: '2025-04-13',
  checkoutDate: '2025-04-15',
};

let roomId = '101';
let orderId = '';
let maintenanceRequestId = '';
let cleaningRequestId = '';

describe('Guest Endpoints', () => {
  it('should get available rooms', async () => {
    const res = await request(app)
      .get('/available-rooms')
      .query({ checkinDate: guestData.checkinDate, checkoutDate: guestData.checkoutDate });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.rooms)).toBe(true);
    if (res.body.rooms.length > 0) {
      roomId = res.body.rooms[0].id;
    }
  });

  it('should check in guest', async () => {
    const res = await request(app)
      .post('/checkin')
      .send({
        username: guestData.username,
        roomId: roomId,
        checkinDate: guestData.checkinDate,
        checkoutDate: guestData.checkoutDate,
      });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Check-in successful');
  });

  it('should fetch guest room details', async () => {
    const res = await request(app)
      .get('/guest-room')
      .query({ guestId: guestData.username });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('roomNumber');
  });

  it('should place food order', async () => {
    const res = await request(app)
      .post('/place-order')
      .send({
        guestId: guestData.username,
        foodItems: [
          { foodId: '1', quantity: 2 },
          { foodId: '2', quantity: 1 },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Order placed successfully');
    if (res.body.orderId) orderId = res.body.orderId;
  });

  it('should get order status', async () => {
    const res = await request(app)
      .get('/check-order')
      .query({ orderId: orderId });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status');
  });

  it('should request maintenance', async () => {
    const res = await request(app)
      .post('/request-maintenance')
      .send({
        guestId: guestData.username,
        roomId: roomId,
        issue: 'Leaking faucet',
      });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Maintenance request successful');
    if (res.body.requestId) maintenanceRequestId = res.body.requestId;
  });

  it('should request cleaning', async () => {
    const res = await request(app)
      .post('/request-cleaning')
      .send({
        guestId: guestData.username,
        roomId: roomId,
        requestType: 'Full cleaning',
      });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Cleaning request successful');
    if (res.body.requestId) cleaningRequestId = res.body.requestId;
  });

  it('should check out guest', async () => {
    const res = await request(app)
      .post('/checkout')
      .send({
        guestId: guestData.username,
        roomId: roomId,
      });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Checkout successful');
  });
});

describe('Maintenance Staff Endpoints', () => {
  it('should get maintenance requests', async () => {
    const res = await request(app).get('/maintenance-requests');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.requests)).toBe(true);
  });

  it('should update maintenance request status', async () => {
    const res = await request(app)
      .post('/update-maintenance-status')
      .send({
        requestId: maintenanceRequestId || '1',
        status: 'Completed',
      });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Maintenance status updated');
  });
});

describe('Cleaner Endpoints', () => {
  it('should get cleaning requests', async () => {
    const res = await request(app).get('/cleaning-requests');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.requests)).toBe(true);
  });

  it('should update cleaning request status', async () => {
    const res = await request(app)
      .post('/update-cleaning-status')
      .send({
        requestId: cleaningRequestId || '1',
        status: 'Completed',
      });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Cleaning status updated');
  });
});

describe('Cook Endpoints', () => {
  it('should get cook orders', async () => {
    const res = await request(app).get('/cook/orders');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.orders)).toBe(true);
  });

  it('should update cook order status', async () => {
    const res = await request(app)
      .post('/cook/update-order')
      .send({
        orderId: orderId || '1',
        status: 'Completed',
      });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Order status updated');
  });
});
