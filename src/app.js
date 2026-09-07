const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth.routes');
const householdRoutes = require('./routes/household.routes');
const expenseRoutes = require('./routes/expense.routes');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'HomeSplit API is running'
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/households', householdRoutes);
app.use('/api/households', expenseRoutes);
app.use('/api/expenses', expenseRoutes);

module.exports = app;