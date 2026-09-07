const mongoose = require('mongoose');

const householdSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },

    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },

    currency: {
      type: String,
      default: 'PHP'
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Household', householdSchema);