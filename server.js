// Responsible for: database connection and starting the server

require('dotenv').config();

const app = require('./src/app');
const connectDatabase = require('./src/config/database');

const { startRecurringBillWorker } = require('./src/modules/bills/bill.recurrence');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDatabase();

  await startRecurringBillWorker();

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

startServer().catch(error => {
  console.error('Server startup failed:', error);
  process.exit(1);
});