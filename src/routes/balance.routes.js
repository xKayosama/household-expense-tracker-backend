const express = require('express');

const {
  getHouseholdBalances
} = require('../controllers/balance.controller');

const { protect } = require('../middleware/auth');
const { householdAccess } = require('../middleware/householdAccess');

const router = express.Router();

router.get(
  '/:id/balances',
  protect,
  householdAccess,
  getHouseholdBalances
);

module.exports = router;