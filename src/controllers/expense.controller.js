const mongoose = require('mongoose');
const Expense = require('../models/Expense');
const HouseholdMember = require('../models/HouseholdMember');

const createExpense = async (req, res) => {
  try {
    const { id: householdId } = req.params;

    const {
      description,
      amount,
      category,
      paidBy,
      splitType,
      participants,
      date,
      notes
    } = req.body;

    // -----------------------------
    // Basic validation
    // -----------------------------

    if (!description) {
      return res.status(400).json({
        success: false,
        message: 'Expense description is required.'
      });
    }

    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Expense amount must be greater than zero.'
      });
    }

    if (!paidBy) {
      return res.status(400).json({
        success: false,
        message: 'paidBy is required.'
      });
    }

    if (!participants || !Array.isArray(participants) || participants.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one participant is required.'
      });
    }

    const normalizedAmount = Number(amount);

    // -----------------------------
    // Check payer membership
    // -----------------------------

    const payerMembership = await HouseholdMember.findOne({
      householdId,
      userId: paidBy,
      status: 'ACTIVE'
    });

    if (!payerMembership) {
      return res.status(400).json({
        success: false,
        message: 'The payer is not an active member of this household.'
      });
    }

    // -----------------------------
    // Check participants
    // -----------------------------

    const participantIds = participants.map(
      (participant) => participant.userId
    );

    // Prevent duplicate participants
    const uniqueParticipantIds = new Set(
      participantIds.map((id) => id.toString())
    );

    if (uniqueParticipantIds.size !== participantIds.length) {
      return res.status(400).json({
        success: false,
        message: 'Duplicate participants are not allowed.'
      });
    }

    const householdMembers = await HouseholdMember.find({
      householdId,
      userId: { $in: participantIds },
      status: 'ACTIVE'
    });

    if (householdMembers.length !== participantIds.length) {
      return res.status(400).json({
        success: false,
        message: 'All participants must be active members of this household.'
      });
    }

    // -----------------------------
    // Split validation
    // -----------------------------

    const normalizedSplitType = splitType || 'EQUAL';

    if (!['EQUAL', 'EXACT'].includes(normalizedSplitType)) {
      return res.status(400).json({
        success: false,
        message: 'Only EQUAL and EXACT split types are currently supported.'
      });
    }

    let finalParticipants;

    // -----------------------------
    // Equal split
    // -----------------------------

    if (normalizedSplitType === 'EQUAL') {
      const baseAmount =
        Math.floor((normalizedAmount / participants.length) * 100) / 100;

      const remainder = Number(
        (normalizedAmount - baseAmount * participants.length).toFixed(2)
      );

      finalParticipants = participants.map((participant, index) => ({
        userId: participant.userId,
        amount: Number(
          (
            baseAmount +
            (index === 0 ? remainder : 0)
          ).toFixed(2)
        )
      }));
    }

    // -----------------------------
    // Exact split
    // -----------------------------

    if (normalizedSplitType === 'EXACT') {
      if (
        participants.some(
          (participant) =>
            participant.amount === undefined ||
            Number(participant.amount) < 0
        )
      ) {
        return res.status(400).json({
          success: false,
          message: 'Each participant must have a valid amount.'
        });
      }

      finalParticipants = participants.map((participant) => ({
        userId: participant.userId,
        amount: Number(Number(participant.amount).toFixed(2))
      }));

      const participantTotal = Number(
        finalParticipants
          .reduce((total, participant) => total + participant.amount, 0)
          .toFixed(2)
      );

      if (participantTotal !== Number(normalizedAmount.toFixed(2))) {
        return res.status(400).json({
          success: false,
          message: 'Participant amounts must equal the expense amount.'
        });
      }
    }

    // -----------------------------
    // Create expense
    // -----------------------------

    const expense = await Expense.create({
      householdId,
      description,
      amount: normalizedAmount,
      category: category || 'OTHERS',
      paidBy,
      splitType: normalizedSplitType,
      participants: finalParticipants,
      date: date || new Date(),
      notes: notes || ''
    });

    // Populate useful information
    await expense.populate([
      {
        path: 'paidBy',
        select: 'firstName lastName email avatar'
      },
      {
        path: 'participants.userId',
        select: 'firstName lastName email avatar'
      }
    ]);

    return res.status(201).json({
      success: true,
      message: 'Expense created successfully.',
      data: {
        expense
      }
    });
  } catch (error) {
    console.error('Create expense error:', error);

    return res.status(500).json({
      success: false,
      message: 'Something went wrong while creating the expense.'
    });
  }
};

const getHouseholdExpenses = async (req, res) => {
  try {
    const { id: householdId } = req.params;

    const {
      page = 1,
      limit = 10,
      category,
      startDate,
      endDate
    } = req.query;

    const currentPage = Math.max(Number(page), 1);
    const currentLimit = Math.min(Math.max(Number(limit), 1), 100);
    const skip = (currentPage - 1) * currentLimit;

    // -----------------------------
    // Build filters
    // -----------------------------

    const filters = {
      householdId
    };

    // -----------------------------
    // Category filter
    // -----------------------------

    if (category) {
      filters.category = category.toUpperCase();
    }

    // -----------------------------
    // Date filter
    // -----------------------------

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

    if (startDate && !dateRegex.test(startDate)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid startDate. Expected format: YYYY-MM-DD.'
      });
    }

    if (endDate && !dateRegex.test(endDate)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid endDate. Expected format: YYYY-MM-DD.'
      });
    }

    if (startDate || endDate) {
      filters.date = {};

      // Start date
      if (startDate) {
        const start = new Date(`${startDate}T00:00:00.000Z`);

        if (Number.isNaN(start.getTime())) {
          return res.status(400).json({
            success: false,
            message: 'Invalid startDate.'
          });
        }

        filters.date.$gte = start;
      }

      // End date
      if (endDate) {
        const end = new Date(`${endDate}T00:00:00.000Z`);

        if (Number.isNaN(end.getTime())) {
          return res.status(400).json({
            success: false,
            message: 'Invalid endDate.'
          });
        }

        // Include the entire end date
        end.setUTCDate(end.getUTCDate() + 1);

        filters.date.$lt = end;
      }
    }

    // -----------------------------
    // Debug
    // -----------------------------

    console.log('Expense filters:', {
      householdId,
      category,
      startDate,
      endDate,
      dateFilter: filters.date
        ? {
            gte: filters.date.$gte?.toISOString(),
            lt: filters.date.$lt?.toISOString()
          }
        : null
    });

    // -----------------------------
    // Get expenses
    // -----------------------------

    const [expenses, total] = await Promise.all([
      Expense.find(filters)
        .populate({
          path: 'paidBy',
          select: 'firstName lastName email avatar'
        })
        .populate({
          path: 'participants.userId',
          select: 'firstName lastName email avatar'
        })
        .sort({
          date: -1,
          createdAt: -1
        })
        .skip(skip)
        .limit(currentLimit),

      Expense.countDocuments(filters)
    ]);

    // -----------------------------
    // Pagination
    // -----------------------------

    const totalPages = Math.ceil(total / currentLimit);

    return res.status(200).json({
      success: true,
      data: {
        expenses,
        pagination: {
          page: currentPage,
          limit: currentLimit,
          total,
          totalPages,
          hasNextPage: currentPage < totalPages,
          hasPreviousPage: currentPage > 1
        }
      }
    });
  } catch (error) {
    console.error('Get household expenses error:', error);

    return res.status(500).json({
      success: false,
      message: 'Something went wrong while retrieving expenses.'
    });
  }
};

const getExpenseById = async (req, res) => {
  try {
    const { expenseId } = req.params;

    const expense = await Expense.findById(expenseId)
      .populate({
        path: 'paidBy',
        select: 'firstName lastName email avatar'
      })
      .populate({
        path: 'participants.userId',
        select: 'firstName lastName email avatar'
      });

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Expense not found.'
      });
    }

    // Check if the authenticated user belongs
    // to the household that owns this expense.
    const membership = await HouseholdMember.findOne({
      householdId: expense.householdId,
      userId: req.user._id,
      status: 'ACTIVE'
    });

    if (!membership) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this expense.'
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        expense
      }
    });
  } catch (error) {
    console.error('Get expense by ID error:', error);

    return res.status(500).json({
      success: false,
      message: 'Something went wrong while retrieving the expense.'
    });
  }
};

module.exports = {
  createExpense,
  getHouseholdExpenses,
  getExpenseById
};
