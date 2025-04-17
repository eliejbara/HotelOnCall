const request = require('supertest');

// Replace with your actual deployed URL
const appUrl = 'https://hotel-on-call.vercel.app';  // Adjust this with your Vercel deployment URL

describe('HotelOnCall Backend API', () => {

  let testGuestEmail = 'john@example.com'; // example guest email for testing
  let testRoomNumber = 101;  // example room number for testing
  let testOrderId; // will store the test order ID for cleanup
  let testMaintenanceRequestId; // will store test maintenance request ID for cleanup
  let testCleaningRequestId; // will store test cleaning request ID for cleanup

  beforeAll(async () => {
    // Setup for the tests
    console.log('Setting up before all tests');

    // Create a guest for testing (you can customize this based on your API)
    const checkinResponse = await request(appUrl)
      .post('/checkin')
      .send({
        guestEmail: testGuestEmail,
        roomNumber: testRoomNumber,
      });
    
    expect(checkinResponse.statusCode).toBe(200);
    expect(checkinResponse.body.success).toBe(true);

    // Create an order for the guest to test order-related functionality
    const orderResponse = await request(appUrl)
      .post('/place-order')
      .send({
        guestEmail: testGuestEmail,
        foodItem: 'Burger',
        quantity: 1,
      });

    expect(orderResponse.statusCode).toBe(200);
    expect(orderResponse.body.success).toBe(true);
    testOrderId = orderResponse.body.orderId;

    // Create a cleaning request for the guest (if applicable)
    const cleaningResponse = await request(appUrl)
      .post('/request-cleaning')
      .send({
        guestEmail: testGuestEmail,
        roomNumber: testRoomNumber,
        time: '10:00 AM',
      });

    expect(cleaningResponse.statusCode).toBe(200);
    expect(cleaningResponse.body.success).toBe(true);
    testCleaningRequestId = cleaningResponse.body.requestId;

    // Create a maintenance request for the guest (if applicable)
    const maintenanceResponse = await request(appUrl)
      .post('/request-maintenance')
      .send({
        guestEmail: testGuestEmail,
        roomNumber: testRoomNumber,
        issue: 'Air conditioner broken',
      });

    expect(maintenanceResponse.statusCode).toBe(200);
    expect(maintenanceResponse.body.success).toBe(true);
    testMaintenanceRequestId = maintenanceResponse.body.requestId;

    // You can add other setup calls if needed (like authenticating users)
  });

  afterAll(async () => {
    // Cleanup after tests
    console.log('Cleaning up after all tests');

    // Delete the created test data (e.g., checkout the guest, delete orders, cleaning, and maintenance requests)

    const checkoutResponse = await request(appUrl)
      .post('/checkout')
      .send({
        guestEmail: testGuestEmail,
      });

    expect(checkoutResponse.statusCode).toBe(200);
    expect(checkoutResponse.body.success).toBe(true);

    // Optionally, delete or update test data as necessary
    if (testOrderId) {
      const cancelOrderResponse = await request(appUrl)
        .post('/update-order-status')
        .send({
          orderId: testOrderId,
          status: 'Cancelled',
        });

      expect(cancelOrderResponse.statusCode).toBe(200);
      expect(cancelOrderResponse.body.success).toBe(true);
    }

    if (testCleaningRequestId) {
      const updateCleaningResponse = await request(appUrl)
        .post('/update-cleaning-status')
        .send({
          requestId: testCleaningRequestId,
          status: 'Cancelled',
        });

      expect(updateCleaningResponse.statusCode).toBe(200);
      expect(updateCleaningResponse.body.success).toBe(true);
    }

    if (testMaintenanceRequestId) {
      const updateMaintenanceResponse = await request(appUrl)
        .post('/update-maintenance-status')
        .send({
          requestId: testMaintenanceRequestId,
          status: 'Resolved',
        });

      expect(updateMaintenanceResponse.statusCode).toBe(200);
      expect(updateMaintenanceResponse.body.success).toBe(true);
    }

    // Additional cleanup can be done if necessary
  });

  it('POST /checkin should check in a guest', async () => {
    const res = await request(appUrl)
      .post('/checkin')
      .send({
        guestEmail: testGuestEmail,
        roomNumber: testRoomNumber,
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.roomNumber).toBe(testRoomNumber);
  });

  it('POST /place-order should create a food order', async () => {
    const res = await request(appUrl)
      .post('/place-order')
      .send({
        guestEmail: testGuestEmail,
        foodItem: 'Burger',
        quantity: 1,
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.orderId).toBeDefined();
  });

  it('POST /update-order-status should update the status of an order', async () => {
    const orderId = testOrderId;

    const res = await request(appUrl)
      .post('/update-order-status')
      .send({
        orderId: orderId,
        status: 'Completed',
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('GET /guest-room/:guestEmail should return guest room details', async () => {
    const res = await request(appUrl).get(`/guest-room/${testGuestEmail}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.roomNumber).toBe(testRoomNumber);
  });

  it('POST /request-cleaning should request cleaning for a room', async () => {
    const res = await request(appUrl)
      .post('/request-cleaning')
      .send({
        guestEmail: testGuestEmail,
        roomNumber: testRoomNumber,
        time: '10:00 AM',
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('GET /guest-cleaning/:guestEmail should return guest cleaning requests', async () => {
    const res = await request(appUrl).get(`/guest-cleaning/${testGuestEmail}`);

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0); // assuming a cleaning request exists
  });

  it('POST /update-cleaning-status should update the cleaning status', async () => {
    const res = await request(appUrl)
      .post('/update-cleaning-status')
      .send({
        roomNumber: testRoomNumber,
        status: 'Completed',
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('POST /request-maintenance should request maintenance for a room', async () => {
    const res = await request(appUrl)
      .post('/request-maintenance')
      .send({
        guestEmail: testGuestEmail,
        roomNumber: testRoomNumber,
        issue: 'Air conditioner broken',
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('GET /guest-maintenance/:guestEmail should return guest maintenance requests', async () => {
    const res = await request(appUrl).get(`/guest-maintenance/${testGuestEmail}`);

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0); // assuming a maintenance request exists
  });

  it('POST /update-maintenance-status should update the maintenance status', async () => {
    const res = await request(appUrl)
      .post('/update-maintenance-status')
      .send({
        roomNumber: testRoomNumber,
        status: 'Resolved',
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('GET /calculate-bill/:roomNumber should return the total bill for a room', async () => {
    const res = await request(appUrl).get(`/calculate-bill/${testRoomNumber}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.totalBill).toBeDefined();
  });

  it('POST /create-checkout-session should create a checkout session', async () => {
    const res = await request(appUrl)
      .post('/create-checkout-session')
      .send({
        roomNumber: testRoomNumber,
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.url).toBeDefined();
  });

  it('POST /finalize-checkout should finalize the checkout process', async () => {
    const res = await request(appUrl)
      .post('/finalize-checkout')
      .send({
        guestEmail: testGuestEmail,
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('POST /checkout should complete checkout', async () => {
    const res = await request(appUrl)
      .post('/checkout')
      .send({
        guestEmail: testGuestEmail,
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
