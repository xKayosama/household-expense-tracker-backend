const express = require('express');

const {
  createBill,
  getHouseholdBills,
  getBillById,
  updateBill,
  deleteBill
} = require('../controllers/bill.controller');

const { protect } = require('../middleware/auth');
const { householdAccess } = require('../middleware/householdAccess');

const router = express.Router();

router.post(
  '/:id/bills',
  protect,
  householdAccess,
  createBill
);

router.get(
  '/:id/bills',
  protect,
  householdAccess,
  getHouseholdBills
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