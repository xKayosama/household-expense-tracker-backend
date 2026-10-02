const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { mock } = require('node:test');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../src/modules/users/User');
const RevokedToken = require('../src/modules/auth/RevokedToken');
const { generateToken } = require('../src/modules/auth/jwt');
const { hashToken } = require('../src/modules/auth/tokenHash');
const { protect } = require('../src/modules/auth/auth.middleware');
const { login, logout, getMe } = require('../src/modules/auth/auth.controller');
const routes = require('../src/modules/auth/auth.routes');

process.env.JWT_SECRET = 'test-secret-only';
afterEach(() => mock.restoreAll());

const response = () => ({
  statusCode: 200,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; }
});

const authenticate = async (token) => {
  const req = { headers: token ? { authorization: `Bearer ${token}` } : {} };
  const res = response();
  let passed = false;
  await protect(req, res, () => { passed = true; });
  return { req, res, passed };
};

test('logout route requires authentication', () => {
  const route = routes.stack.find((layer) => layer.route?.path === '/logout').route;
  assert.equal(route.methods.post, true);
  assert.deepEqual(route.stack.map((layer) => layer.handle), [protect, logout]);
});

test('get me returns the authenticated account role', async () => {
  const res = response();
  await getMe({
    user: {
      _id: 'user-1',
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      role: 'ADMIN'
    }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.user.role, 'ADMIN');
});

test('login returns the authenticated account role', async () => {
  mock.method(User, 'findOne', async () => ({
    _id: 'user-1',
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@example.com',
    password: 'hashed-password',
    role: 'ADMIN'
  }));
  mock.method(bcrypt, 'compare', async () => true);

  const res = response();
  await login({
    body: {
      email: 'ada@example.com',
      password: 'password123'
    }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.user.role, 'ADMIN');
});

test('logout rejects token reuse while another session remains valid', async () => {
  const revoked = new Map();
  mock.method(RevokedToken, 'exists', async ({ tokenHash }) => revoked.has(tokenHash));
  mock.method(RevokedToken, 'updateOne', async (filter, update, options) => {
    assert.equal(options.upsert, true);
    revoked.set(filter.tokenHash, update.$setOnInsert.expiresAt);
  });
  mock.method(User, 'findById', () => ({ select: async () => ({ _id: 'user-1' }) }));
  const token = generateToken('user-1');
  const other = generateToken('user-1');
  assert.notEqual(token, other);
  const session = await authenticate(token);
  assert.equal(session.passed, true);
  const res = response();
  await logout(session.req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(revoked.get(hashToken(token)).getTime(), jwt.decode(token).exp * 1000);
  assert.equal(revoked.has(token), false);
  const reused = await authenticate(token);
  assert.equal(reused.passed, false);
  assert.equal(reused.res.statusCode, 401);
  assert.equal((await authenticate(other)).passed, true);
});

test('missing, malformed and expired tokens are rejected', async () => {
  const expired = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET, { expiresIn: -1 });
  for (const token of [undefined, 'bad-token', expired]) {
    const result = await authenticate(token);
    assert.equal(result.passed, false);
    assert.equal(result.res.statusCode, 401);
  }
});

test('existing tokens without a unique ID can still authenticate', async () => {
  mock.method(RevokedToken, 'exists', async () => false);
  mock.method(User, 'findById', () => ({ select: async () => ({ _id: 'user-1' }) }));
  const token = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET, { expiresIn: '7d' });
  assert.equal((await authenticate(token)).passed, true);
});

test('revocation lookup failure does not grant access', async () => {
  mock.method(RevokedToken, 'exists', async () => { throw new Error('Database unavailable'); });
  const result = await authenticate(generateToken('user-1'));
  assert.equal(result.passed, false);
  assert.equal(result.res.statusCode, 401);
});

test('logout reports failure if revocation cannot be saved', async () => {
  mock.method(console, 'error', () => {});
  mock.method(RevokedToken, 'updateOne', async () => { throw new Error('Database unavailable'); });
  const res = response();
  await logout({ auth: { tokenHash: 'hash', expiresAt: new Date() } }, res);
  assert.equal(res.statusCode, 500);
  assert.equal(res.body.success, false);
});

test('revocation records have unique hashes and automatic expiration indexes', () => {
  const indexes = RevokedToken.schema.indexes();
  assert.ok(indexes.some(([keys, options]) => keys.tokenHash === 1 && options.unique));
  assert.ok(indexes.some(([keys, options]) => keys.expiresAt === 1 && options.expireAfterSeconds === 0));
});
