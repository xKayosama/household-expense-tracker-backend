const mongoose = require('mongoose');

const groupMemberSchema = new mongoose.Schema(
  {
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
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

// Keep the existing MongoDB collection to preserve deployed data.
module.exports = mongoose.model(
  'GroupMember',
  groupMemberSchema,
  'householdmembers'
);