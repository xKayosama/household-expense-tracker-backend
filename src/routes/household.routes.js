const express = require('express');

const {
  createHousehold,
  getMyHouseholds,
  getHouseholdById,
  addHouseholdMember,
  removeHouseholdMember,
  getHouseholdMembers,
  updateHousehold,
  deleteHousehold
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

router.get(
  '/:id/members',
  protect,
  householdAccess,
  getHouseholdMembers
);

router.put(
  '/:id',
  protect,
  householdAccess,
  updateHousehold
);

router.delete(
  '/:id',
  protect,
  householdAccess,
  deleteHousehold
);

module.exports = router;