const Expense = require('../expenses/Expense');
const GroupMember = require('../groups/GroupMember');

const getGroupSettlements = async (req, res) => {
  try {
    const { id: groupId } = req.params;

    // Get active group members
    const memberships = await GroupMember.find({
      groupId,
      status: 'ACTIVE'
    }).populate({
      path: 'userId',
      select: 'firstName lastName email avatar'
    });

    if (memberships.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No active group members found.'
      });
    }

    // Get group expenses
    const expenses = await Expense.find({
      groupId
    });

    // Calculate each member's paid and owed amounts
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

    expenses.forEach((expense) => {
      const payerId = expense.paidBy.toString();

      if (balances[payerId]) {
        balances[payerId].paid += expense.amount;
      }

      expense.participants.forEach((participant) => {
        const participantId = participant.userId.toString();

        if (balances[participantId]) {
          balances[participantId].owed += participant.amount;
        }
      });
    });

    // Calculate net balances
    const creditors = [];
    const debtors = [];

    Object.values(balances).forEach((balance) => {
      balance.paid = Number(balance.paid.toFixed(2));
      balance.owed = Number(balance.owed.toFixed(2));

      balance.net = Number(
        (balance.paid - balance.owed).toFixed(2)
      );

      if (balance.net > 0) {
        creditors.push({
          user: balance.user,
          amount: balance.net
        });
      }

      if (balance.net < 0) {
        debtors.push({
          user: balance.user,
          amount: Math.abs(balance.net)
        });
      }
    });

    // Calculate settlements
    const settlements = [];

    let debtorIndex = 0;
    let creditorIndex = 0;

    while (
      debtorIndex < debtors.length &&
      creditorIndex < creditors.length
    ) {
      const debtor = debtors[debtorIndex];
      const creditor = creditors[creditorIndex];

      const amount = Number(
        Math.min(
          debtor.amount,
          creditor.amount
        ).toFixed(2)
      );

      if (amount > 0) {
        settlements.push({
          from: debtor.user,
          to: creditor.user,
          amount
        });
      }

      debtor.amount = Number(
        (debtor.amount - amount).toFixed(2)
      );

      creditor.amount = Number(
        (creditor.amount - amount).toFixed(2)
      );

      if (debtor.amount <= 0) {
        debtorIndex++;
      }

      if (creditor.amount <= 0) {
        creditorIndex++;
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Group settlements calculated successfully.',
      data: {
        settlements
      }
    });
  } catch (error) {
    console.error(
      'Get group settlements error:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Something went wrong while calculating group settlements.'
    });
  }
};

module.exports = {
  getGroupSettlements
};