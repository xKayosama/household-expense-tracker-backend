const express = require('express');

const {
  getGroupDashboard
} = require('./dashboard.controller');

const { protect } = require('../auth/auth.middleware');
const { groupAccess } = require('../groups/groupAccess.middleware');

const router = express.Router();

router.get(
  '/:id/dashboard',
  protect,
  groupAccess,
  getGroupDashboard
);

module.exports = router;