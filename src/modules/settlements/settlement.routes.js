const express = require('express');

const {
  getGroupSettlements
} = require('./settlement.controller');

const { protect } = require('../auth/auth.middleware');
const { groupAccess } = require('../groups/groupAccess.middleware');

const router = express.Router();

router.get(
  '/:id/settlements',
  protect,
  groupAccess,
  getGroupSettlements
);

module.exports = router;