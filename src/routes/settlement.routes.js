const express = require('express');

const {
  getHouseholdSettlements
} = require('../controllers/settlement.controller');

const { protect } = require('../middleware/auth');
const { householdAccess } = require('../middleware/householdAccess');

const router = express.Router();

router.get(
  '/:id/settlements',
  protect,
  householdAccess,
  getHouseholdSettlements
);

module.exports = router;