const mongoose = require('mongoose');

const billSchema = new mongoose.Schema(
  {
    householdId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Household',
      required: true
    },

    name: {
      type: String,
      required: true,
      trim: true
    },

    amount: {
      type: Number,
      required: true,
      min: 0.01
    },

    category: {
      type: String,
      enum: [
        'RENT',
        'ELECTRICITY',
        'WATER',
        'INTERNET',
        'PHONE',
        'SUBSCRIPTION',
        'INSURANCE',
        'OTHER'
      ],
      default: 'OTHER'
    },

    dueDate: {
      type: Date,
      required: true
    },

    isRecurring: {
      type: Boolean,
      default: false
    },

    recurrence: {
      type: String,
      enum: [
        'MONTHLY',
        'WEEKLY',
        'YEARLY',
        null
      ],
      default: null
    },

    paidBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },

    status: {
      type: String,
      enum: [
        'PENDING',
        'PAID',
        'OVERDUE'
      ],
      default: 'PENDING'
    },

    notes: {
      type: String,
      trim: true,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Bill', billSchema);