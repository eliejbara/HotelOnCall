// __tests__/googleAuth.test.js

jest.mock('passport', () => ({
    initialize: jest.fn().mockReturnValue((req, res, next) => next()),  // Mock initialize
    session: jest.fn().mockReturnValue((req, res, next) => next()),     // Mock session
    serializeUser: jest.fn(),
    deserializeUser: jest.fn(),
    authenticate: jest.fn().mockReturnValue((req, res, next) => next()),  // Mock authenticate
    use: jest.fn(),
}));

const request = require('supertest');
const app = require('../server');  // Adjust the path as necessary to point to your Express app
const db = require('../db');    // Mock DB module

jest.mock('../db', () => ({
  query: jest.fn().mockResolvedValue({}),
}));

let mockSession;
beforeEach(() => {
    mockSession = {};
    app.use((req, res, next) => {
        req.session = mockSession;
        next();
    });
});

describe('Google Authentication Flow', () => {
    it('should redirect to /guest_services.html if the user is a guest and already checked in', async () => {
        db.query.mockResolvedValueOnce({
            rows: [{ email: 'testuser@example.com', userType: 'guest', id: 'guestId' }]
        });

        db.query.mockResolvedValueOnce({
            rows: [{ guest_id: 'guestId' }]  // Simulating that the guest is already checked in
        });

        const res = await request(app)
            .get('/auth/google/callback')
            .query({ success: 'true' });

        expect(res.status).toBe(302);  // Redirect status code
        expect(res.header.location).toContain('/guest_services.html');  // Check for guest redirect
    });

    it('should redirect to /checkin.html if the user is a guest and not checked in', async () => {
        db.query.mockResolvedValueOnce({
            rows: [{ email: 'testuser@example.com', userType: 'guest', id: 'guestId' }]
        });

        db.query.mockResolvedValueOnce({
            rows: []  // Simulating that the guest has no check-in record
        });

        const res = await request(app)
            .get('/auth/google/callback')
            .query({ success: 'true' });

        expect(res.status).toBe(302);  // Redirect status code
        expect(res.header.location).toContain('/checkin.html');  // Check for check-in page redirect
    });

    it('should redirect to /staff_selection.html if the user is staff', async () => {
        db.query.mockResolvedValueOnce({
            rows: [{ email: 'staff@example.com', userType: 'staff', id: 'staffId' }]
        });

        const res = await request(app)
            .get('/auth/google/callback')
            .query({ success: 'true' });

        expect(res.status).toBe(302);  // Redirect status code
        expect(res.header.location).toContain('/staff_selection.html');  // Check for staff redirect
    });

    it('should redirect to /manager_dashboard.html if the user is a manager', async () => {
        db.query.mockResolvedValueOnce({
            rows: [{ email: 'manager@example.com', userType: 'manager', id: 'managerId' }]
        });

        const res = await request(app)
            .get('/auth/google/callback')
            .query({ success: 'true' });

        expect(res.status).toBe(302);  // Redirect status code
        expect(res.header.location).toContain('/manager_dashboard.html');  // Check for manager redirect
    });
});
