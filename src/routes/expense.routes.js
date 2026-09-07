const express = require('express');

const {
  createExpense,
  getHouseholdExpenses,
  getExpenseById,
  updateExpense
} = require('../controllers/expense.controller');

const { protect } = require('../middleware/auth');
const { householdAccess } = require('../middleware/householdAccess');

const router = express.Router();

router.post(
  '/:id/expenses',
  protect,
  householdAccess,
  createExpense
);
  
router.get(
  '/:id/expenses',
  protect,
  householdAccess,
  getHouseholdExpenses
);

router.get(
  '/:expenseId',
  protect,
  getExpenseById
);

router.put(
  '/:expenseId',
  protect,
  updateExpense
);

module.exports = router;