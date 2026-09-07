const mongoose = require('mongoose');

const householdMemberSchema = new mongoose.Schema(
  {
    householdId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Household',
      required: true
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },

    role: {
      type: String,
      enum: ['OWNER', 'MEMBER'],
      default: 'MEMBER'
    },

    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE'],
      default: 'ACTIVE'
    },

    joinedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model(
  'HouseholdMember',
  householdMemberSchema
);