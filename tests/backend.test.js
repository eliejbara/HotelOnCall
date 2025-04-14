const request = require('supertest');
const app = 'https://your-vercel-deployed-backend-url'; // Replace with your actual Vercel URL

// Mock data for staff authentication
const staff = {
  username: 'staff1',
  password: '123',
};

// Mock guest data
const guestData = {
  username: 'guest123',
  roomId: '101',
  checkinDate: '2025-04-13',
  checkoutDate: '2025-04-15',
};

// Mock order data
const orderData = {
  guestId: 'guest123',
  foodItems: [
    { foodId: '1', quantity: 2 },
    { foodId: '3', quantity: 1 },
  ],
};

// Mock maintenance request data
const maintenanceRequestData = {
  guestId: 'guest123',
  roomId: '101',
  issue: 'Air conditioning not working',
};

// Mock cleaning request data
const cleaningRequestData = {
  guestId: 'guest123',
  roomId: '101',
  requestType: 'Full cleaning',
};

// Mock staff roles for the cook, maintenance, and cleaner
const staffRoles = {
  cook: {
    username: 'cook123',
    password: '123',
  },
  maintenance: {
    username: 'maintenance123',
    password: '123',
  },
  cleaner: {
    username: 'cleaner123',
    password: '123',
  },
};

describe('Guest Endpoints', () => {
  // Test for check-in, ensuring room is available
  it('should check in a guest', async () => {
    const checkinResponse = await request(app)
      .get('/available-rooms') // Check available rooms before attempting to check-in
      .query({ checkinDate: guestData.checkinDate, checkoutDate: guestData.checkoutDate });

    const availableRooms = checkinResponse.body.rooms;

    // Ensure there's at least one available room
    if (availableRooms.length > 0) {
      const response = await request(app)
        .post('/checkin')
        .send({
          username: guestData.username,
          roomId: availableRooms[0].id, // Use first available room
          checkinDate: guestData.checkinDate,
          checkoutDate: guestData.checkoutDate,
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Check-in successful');
    } else {
      console.log('No available rooms for check-in');
    }
  });

  it('should check out a guest', async () => {
    const response = await request(app)
      .post('/checkout')
      .send({
        guestId: guestData.username,
        roomId: guestData.roomId,
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('message', 'Checkout successful');
  });

  it('should place an order', async () => {
    const response = await request(app)
      .post('/place-order')
      .send(orderData);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('message', 'Order placed successfully');
  });

  it('should check the order status', async () => {
    const response = await request(app)
      .get('/check-order')
      .query({ orderId: '12345' });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status');
  });

  it('should fetch guest room details', async () => {
    const response = await request(app)
      .get('/guest-room')
      .query({ guestId: guestData.username });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('roomNumber');
  });
});

describe('Maintenance Endpoints', () => {
  it('should request maintenance', async () => {
    const response = await request(app)
      .post('/request-maintenance')
      .send(maintenanceRequestData);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('message', 'Maintenance request successful');
  });

  it('should fetch maintenance requests', async () => {
    const response = await request(app)
      .get('/maintenance-requests');

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.requests)).toBe(true);
  });

  it('should update maintenance status', async () => {
    const response = await request(app)
      .post('/update-maintenance-status')
      .send({ requestId: '12345', status: 'Completed' });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('message', 'Maintenance status updated');
  });
});

describe('Cleaning Endpoints', () => {
  it('should request cleaning', async () => {
    const response = await request(app)
      .post('/request-cleaning')
      .send(cleaningRequestData);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('message', 'Cleaning request successful');
  });

  it('should fetch cleaning requests', async () => {
    const response = await request(app)
      .get('/cleaning-requests');

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.requests)).toBe(true);
  });

  it('should update cleaning status', async () => {
    const response = await request(app)
      .post('/update-cleaning-status')
      .send({ requestId: '12345', status: 'Completed' });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('message', 'Cleaning status updated');
  });
});

describe('Cook Endpoints', () => {
  it('should fetch cook orders', async () => {
    const response = await request(app)
      .get('/cook/orders');

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.orders)).toBe(true);
  });

  it('should update cook order status', async () => {
    const response = await request(app)
      .post('/cook/update-order')
      .send({ orderId: '12345', status: 'Completed' });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('message', 'Order status updated');
  });
});
