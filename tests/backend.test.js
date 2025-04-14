const request = require('supertest');
const app = 'https://hotel-on-call-backend.up.railway.app'; // Replace with your backend URL if different

const guestData = {
  username: 'guest_test_' + Date.now(),
  checkinDate: '2025-04-13',
  checkoutDate: '2025-04-15',
};

const orderItems = [
  { foodId: '1', quantity: 2 },
  { foodId: '3', quantity: 1 },
];

const maintenanceIssue = 'Leaky faucet';
const cleaningType = 'Full cleaning';

let guestId = '';
let roomId = '';
let orderId = '';
let maintenanceRequestId = '';
let cleaningRequestId = '';

describe('HotelOnCall Backend Tests', () => {
  it('should check in a guest', async () => {
    const checkRooms = await request(app)
      .get('/available-rooms')
      .query({ checkinDate: guestData.checkinDate, checkoutDate: guestData.checkoutDate });

    expect(checkRooms.status).toBe(200);
    expect(Array.isArray(checkRooms.body.rooms)).toBe(true);
    expect(checkRooms.body.rooms.length).toBeGreaterThan(0);

    roomId = checkRooms.body.rooms[0].id;

    const checkin = await request(app)
      .post('/checkin')
      .send({
        username: guestData.username,
        roomId,
        checkinDate: guestData.checkinDate,
        checkoutDate: guestData.checkoutDate,
      });

    expect(checkin.status).toBe(200);
    expect(checkin.body).toHaveProperty('message', 'Check-in successful');
    guestId = guestData.username;
  });

  it('should place a food order', async () => {
    const response = await request(app)
      .post('/place-order')
      .send({ guestId, foodItems: orderItems });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('message', 'Order placed successfully');
    if (response.body.orderId) orderId = response.body.orderId;
  });

  it('should check the order status', async () => {
    if (!orderId) return console.warn('Order ID not captured. Skipping.');
    const response = await request(app)
      .get('/check-order')
      .query({ orderId });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status');
  });

  it('should request maintenance', async () => {
    const response = await request(app)
      .post('/request-maintenance')
      .send({ guestId, roomId, issue: maintenanceIssue });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('message', 'Maintenance request successful');
    if (response.body.requestId) maintenanceRequestId = response.body.requestId;
  });

  it('should fetch maintenance requests', async () => {
    const response = await request(app).get('/maintenance-requests');
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.requests)).toBe(true);
  });

  it('should update maintenance status', async () => {
    if (!maintenanceRequestId) return console.warn('No maintenance request ID. Skipping.');
    const response = await request(app)
      .post('/update-maintenance-status')
      .send({ requestId: maintenanceRequestId, status: 'Completed' });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('message', 'Maintenance status updated');
  });

  it('should request cleaning', async () => {
    const response = await request(app)
      .post('/request-cleaning')
      .send({ guestId, roomId, requestType: cleaningType });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('message', 'Cleaning request successful');
    if (response.body.requestId) cleaningRequestId = response.body.requestId;
  });

  it('should fetch cleaning requests', async () => {
    const response = await request(app).get('/cleaning-requests');
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.requests)).toBe(true);
  });

  it('should update cleaning status', async () => {
    if (!cleaningRequestId) return console.warn('No cleaning request ID. Skipping.');
    const response = await request(app)
      .post('/update-cleaning-status')
      .send({ requestId: cleaningRequestId, status: 'Completed' });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('message', 'Cleaning status updated');
  });

  it('should fetch cook orders', async () => {
    const response = await request(app).get('/cook/orders');
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.orders)).toBe(true);
  });

  it('should update order status as cook', async () => {
    if (!orderId) return console.warn('No order ID for cook. Skipping.');
    const response = await request(app)
      .post('/cook/update-order')
      .send({ orderId, status: 'Completed' });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('message', 'Order status updated');
  });

  it('should get guest room details', async () => {
    const response = await request(app)
      .get('/guest-room')
      .query({ guestId });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('roomNumber');
  });

  it('should check out a guest', async () => {
    const response = await request(app)
      .post('/checkout')
      .send({ guestId, roomId });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('message', 'Checkout successful');
  });
});
