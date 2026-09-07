const express = require('express');

const {
  createExpense,
  getHouseholdExpenses,
  getExpenseById
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

module.exports = router;