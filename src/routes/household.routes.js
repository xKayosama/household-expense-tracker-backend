const express = require('express');

const {
  createHousehold,
  getMyHouseholds,
  getHouseholdById,
  addHouseholdMember,
  removeHouseholdMember
} = require('../controllers/household.controller');

const { protect } = require('../middleware/auth');
const { householdAccess } = require('../middleware/householdAccess');

const router = express.Router();

router.post('/', protect, createHousehold);

router.get('/', protect, getMyHouseholds);

router.get(
  '/:id',
  protect,
  householdAccess,
  getHouseholdById
);

router.post(
  '/:id/members',
  protect,
  householdAccess,
  addHouseholdMember
);

router.delete(
  '/:id/members/:userId',
  protect,
  householdAccess,
  removeHouseholdMember
);

module.exports = router;