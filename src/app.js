const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth.routes');
const householdRoutes = require('./routes/household.routes');
const expenseRoutes = require('./routes/expense.routes');
const balanceRoutes = require('./routes/balance.routes');
const settlementRoutes = require('./routes/settlement.routes');
const billRoutes = require('./routes/bill.routes');

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
app.use('/api/households', balanceRoutes);
app.use('/api/households', settlementRoutes);
app.use('/api/households', billRoutes);
app.use('/api/bills', billRoutes);

module.exports = app;