const express = require('express');

const {
  getHouseholdDashboard
} = require('../controllers/dashboard.controller');

const { protect } = require('../middleware/auth');
const { householdAccess } = require('../middleware/householdAccess');

const router = express.Router();

router.get(
  '/:id/dashboard',
  protect,
  householdAccess,
  getHouseholdDashboard
);

module.exports = router;