const jwt = require('jsonwebtoken');
const { randomUUID } = require('node:crypto');

const generateToken = (userId) => {
  return jwt.sign(
    {
      userId
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
      jwtid: randomUUID()
    }
  );
};

module.exports = {
  generateToken
};
