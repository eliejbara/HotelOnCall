const passport = {
  authenticate: jest.fn((strategy, options) => {
    return (req, res, next) => {
      // Mock user data for different test scenarios
      req.user = { email: 'testuser@example.com', userType: 'guest' }; // Default user is a guest
      next();
    };
  }),
  use: jest.fn(), // Mock `passport.use`
  initialize: jest.fn(() => (req, res, next) => next()),
  session: jest.fn(() => (req, res, next) => next())
};

// Export the mock
module.exports = passport;
