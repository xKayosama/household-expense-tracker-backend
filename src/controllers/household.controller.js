const User = require('../models/User');
const Household = require('../models/Household');
const HouseholdMember = require('../models/HouseholdMember');

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

module.exports = {
  createHousehold,
  getMyHouseholds,
  getHouseholdById,
  addHouseholdMember,
  removeHouseholdMember
};