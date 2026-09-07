const Expense = require('../models/Expense');
const HouseholdMember = require('../models/HouseholdMember');

const getHouseholdBalances = async (req, res) => {
  try {
    const { id: householdId } = req.params;

    // Get active household members
    const memberships = await HouseholdMember.find({
      householdId,
      status: 'ACTIVE'
    }).populate({
      path: 'userId',
      select: 'firstName lastName email avatar'
    });

    if (memberships.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No active household members found.'
      });
    }

    // Get all household expenses
    const expenses = await Expense.find({
      householdId
    });

    // Initialize balances
    const balances = {};

    memberships.forEach((membership) => {
      const userId = membership.userId._id.toString();

      balances[userId] = {
        user: membership.userId,
        paid: 0,
        owed: 0,
        net: 0
      };
    });

    // Calculate paid and owed amounts
    expenses.forEach((expense) => {
      const payerId = expense.paidBy.toString();

      // Amount paid by the person
      if (balances[payerId]) {
        balances[payerId].paid += expense.amount;
      }

      // Amount owed by each participant
      expense.participants.forEach((participant) => {
        const participantId = participant.userId.toString();

        if (balances[participantId]) {
          balances[participantId].owed += participant.amount;
        }
      });
    });

    // Calculate net balance
    Object.values(balances).forEach((balance) => {
      balance.paid = Number(balance.paid.toFixed(2));
      balance.owed = Number(balance.owed.toFixed(2));

      balance.net = Number(
        (balance.paid - balance.owed).toFixed(2)
      );
    });

    // Calculate household totals
    const totalExpenses = expenses.reduce(
      (total, expense) => total + expense.amount,
      0
    );

    const totalOwed = Object.values(balances).reduce(
      (total, balance) => total + balance.owed,
      0
    );

    return res.status(200).json({
      success: true,
      message: 'Household balances retrieved successfully.',
      data: {
        totalExpenses: Number(totalExpenses.toFixed(2)),
        totalOwed: Number(totalOwed.toFixed(2)),
        members: Object.values(balances)
      }
    });
  } catch (error) {
    console.error('Get household balances error:', error);

    return res.status(500).json({
      success: false,
      message: 'Something went wrong while calculating household balances.'
    });
  }
};

module.exports = {
  getHouseholdBalances
};