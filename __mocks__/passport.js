// __mocks__/passport.js
module.exports = {
  use: jest.fn(),
  authenticate: jest.fn(),
  serializeUser: jest.fn(),
  deserializeUser: jest.fn(),
};
