const User = require('../models/User');
const Household = require('../models/Household');
const HouseholdMember = require('../models/HouseholdMember');
const Expense = require('../models/Expense');
const Bill = require('../models/Bill');

const createHousehold = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Household name is required.'
      });
    }

    const household = await Household.create({
      name: name.trim(),
      ownerId: req.user._id
    });

    await HouseholdMember.create({
      householdId: household._id,
      userId: req.user._id,
      role: 'OWNER'
    });

    return res.status(201).json({
      success: true,
      message: 'Household created successfully.',
      data: {
        household
      }
    });
  } catch (error) {
    console.error('Create household error:', error);

    return res.status(500).json({
      success: false,
      message: 'Something went wrong while creating the household.'
    });
  }
};

const getMyHouseholds = async (req, res) => {
  try {
    const memberships = await HouseholdMember.find({
      userId: req.user._id,
      status: 'ACTIVE'
    }).populate({
      path: 'householdId',
      populate: {
        path: 'ownerId',
        select: 'firstName lastName email'
      }
    });

    const households = memberships.map((membership) => ({
      id: membership.householdId._id,
      name: membership.householdId.name,
      currency: membership.householdId.currency,
      role: membership.role,
      owner: membership.householdId.ownerId,
      joinedAt: membership.joinedAt
    }));

    return res.status(200).json({
      success: true,
      data: {
        households
      }
    });
  } catch (error) {
    console.error('Get households error:', error);

    return res.status(500).json({
      success: false,
      message: 'Something went wrong while retrieving your households.'
    });
  }
};

const getHouseholdById = async (req, res) => {
  try {
    const members = await HouseholdMember.find({
      householdId: req.household._id,
      status: 'ACTIVE'
    }).populate({
      path: 'userId',
      select: 'firstName lastName email avatar'
    });

    return res.status(200).json({
      success: true,
      data: {
        household: {
          id: req.household._id,
          name: req.household.name,
          currency: req.household.currency,
          ownerId: req.household.ownerId,
          role: req.membership.role,
          createdAt: req.household.createdAt,
          updatedAt: req.household.updatedAt
        },

        members: members.map((member) => ({
          id: member.userId._id,
          firstName: member.userId.firstName,
          lastName: member.userId.lastName,
          email: member.userId.email,
          avatar: member.userId.avatar,
          role: member.role,
          joinedAt: member.joinedAt
        }))
      }
    });
  } catch (error) {
    console.error('Get household error:', error);

    return res.status(500).json({
      success: false,
      message: 'Something went wrong while retrieving the household.'
    });
  }
};

const addHouseholdMember = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required.'
      });
    }

    // Only the household owner can add members
    if (req.membership.role !== 'OWNER') {
      return res.status(403).json({
        success: false,
        message: 'Only the household owner can add members.'
      });
    }

    // Find the user
    const user = await User.findOne({
      email: email.toLowerCase()
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No user found with this email.'
      });
    }

    // Check if already a member
    const existingMembership = await HouseholdMember.findOne({
      householdId: req.household._id,
      userId: user._id
    });

    if (existingMembership) {
      return res.status(409).json({
        success: false,
        message: 'User is already a member of this household.'
      });
    }

    // Add member
    const membership = await HouseholdMember.create({
      householdId: req.household._id,
      userId: user._id,
      role: 'MEMBER'
    });

    return res.status(201).json({
      success: true,
      message: 'Member added successfully.',
      data: {
        member: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: membership.role,
          joinedAt: membership.joinedAt
        }
      }
    });
  } catch (error) {
    console.error('Add household member error:', error);

    return res.status(500).json({
      success: false,
      message: 'Something went wrong while adding the member.'
    });
  }
};

const removeHouseholdMember = async (req, res) => {
  try {
    const { userId } = req.params;

    // Only the owner can remove members
    if (req.membership.role !== 'OWNER') {
      return res.status(403).json({
        success: false,
        message: 'Only the household owner can remove members.'
      });
    }

    // Prevent the owner from removing themselves
    if (req.user._id.toString() === userId) {
      return res.status(400).json({
        success: false,
        message: 'The household owner cannot remove themselves.'
      });
    }

    const membership = await HouseholdMember.findOne({
      householdId: req.household._id,
      userId,
      status: 'ACTIVE'
    });

    if (!membership) {
      return res.status(404).json({
        success: false,
        message: 'Household member not found.'
      });
    }

    membership.status = 'INACTIVE';
    await membership.save();

    return res.status(200).json({
      success: true,
      message: 'Member removed successfully.'
    });
  } catch (error) {
    console.error('Remove household member error:', error);

    return res.status(500).json({
      success: false,
      message: 'Something went wrong while removing the member.'
    });
  }
};

const getHouseholdMembers = async (req, res) => {
  try {
    const { id: householdId } = req.params;

    const members = await HouseholdMember.find({
      householdId,
      status: 'ACTIVE'
    })
      .populate({
        path: 'userId',
        select: 'firstName lastName email avatar'
      })
      .sort({
        role: 1,
        joinedAt: 1
      });

    return res.status(200).json({
      code: 200,
      success: true,
      message: 'Household members retrieved successfully.',
      data: {
        members
      }
    });
  } catch (error) {
    console.error('Get household members error:', error);

    return res.status(500).json({
      code: 500,
      success: false,
      message:
        'Something went wrong while retrieving household members.'
    });
  }
};

const updateHousehold = async (req, res) => {
  try {
    const { id: householdId } = req.params;
    const { name, currency } = req.body;

    const household = await Household.findById(householdId);

    if (!household) {
      return res.status(404).json({
        code: 404,
        success: false,
        message: 'Household not found.'
      });
    }

    // Only the owner can update the household
    if (household.ownerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        code: 403,
        success: false,
        message: 'Only the household owner can update this household.'
      });
    }

    if (name !== undefined) {
      const updatedName = name.trim();

      if (!updatedName) {
        return res.status(400).json({
          code: 400,
          success: false,
          message: 'Household name is required.'
        });
      }

      household.name = updatedName;
    }

    if (currency !== undefined) {
      const updatedCurrency = currency.trim().toUpperCase();

      if (!updatedCurrency) {
        return res.status(400).json({
          code: 400,
          success: false,
          message: 'Currency is required.'
        });
      }

      household.currency = updatedCurrency;
    }

    await household.save();

    return res.status(200).json({
      code: 200,
      success: true,
      message: 'Household updated successfully.',
      data: {
        household
      }
    });
  } catch (error) {
    console.error('Update household error:', error);

    return res.status(500).json({
      code: 500,
      success: false,
      message:
        'Something went wrong while updating the household.'
    });
  }
};

const deleteHousehold = async (req, res) => {
  try {
    const { id: householdId } = req.params;

    const household = await Household.findById(householdId);

    if (!household) {
      return res.status(404).json({
        code: 404,
        success: false,
        message: 'Household not found.'
      });
    }

    // Only the owner can delete the household
    if (household.ownerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        code: 403,
        success: false,
        message: 'Only the household owner can delete this household.'
      });
    }

    await Household.findByIdAndDelete(householdId);

    // Remove household memberships
    await HouseholdMember.deleteMany({
      householdId
    });

    // Remove household expenses
    await Expense.deleteMany({
      householdId
    });

    // Remove household bills
    await Bill.deleteMany({
      householdId
    });

    return res.status(200).json({
      code: 200,
      success: true,
      message: 'Household deleted successfully.'
    });
  } catch (error) {
    console.error('Delete household error:', error);

    return res.status(500).json({
      code: 500,
      success: false,
      message:
        'Something went wrong while deleting the household.'
    });
  }
};


module.exports = {
  createHousehold,
  getMyHouseholds,
  getHouseholdById,
  addHouseholdMember,
  removeHouseholdMember,
  getHouseholdMembers,
  updateHousehold,
  deleteHousehold
};