const express = require('express');

const {
  getGroupBalances
} = require('./balance.controller');

const { protect } = require('../auth/auth.middleware');
const { groupAccess } = require('../groups/groupAccess.middleware');

const router = express.Router();

router.get(
  '/:id/balances',
  protect,
  groupAccess,
  getGroupBalances
);

module.exports = router;