const Household = require('../models/Household');
const HouseholdMember = require('../models/HouseholdMember');

const householdAccess = async (req, res, next) => {
  try {
    const { id } = req.params;

    const household = await Household.findById(id);

    if (!household) {
      return res.status(404).json({
        success: false,
        message: 'Household not found.'
      });
    }

    const membership = await HouseholdMember.findOne({
      householdId: id,
      userId: req.user._id,
      status: 'ACTIVE'
    });

    if (!membership) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this household.'
      });
    }

    req.household = household;
    req.membership = membership;

    next();
  } catch (error) {
    console.error('Household access error:', error);

    return res.status(500).json({
      success: false,
      message: 'Something went wrong while checking household access.'
    });
  }
};

module.exports = {
  householdAccess
};