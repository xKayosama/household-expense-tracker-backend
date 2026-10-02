const express = require('express');

const {
  createBill,
  getGroupBills,
  getBillById,
  updateBill,
  deleteBill
} = require('./bill.controller');

const { protect } = require('../auth/auth.middleware');
const { groupAccess } = require('../groups/groupAccess.middleware');

const router = express.Router();

router.post(
  '/:id/bills',
  protect,
  groupAccess,
  createBill
);

router.get(
  '/:id/bills',
  protect,
  groupAccess,
  getGroupBills
);

router.get(
  '/:billId',
  protect,
  getBillById
);

router.put(
  '/:billId',
  protect,
  updateBill
);

router.delete(
  '/:billId',
  protect,
  deleteBill
);

module.exports = router;