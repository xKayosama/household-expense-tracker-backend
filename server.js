// Responsible for: database connection and starting the server

require('dotenv').config();

const app = require('./src/app');
const connectDatabase = require('./src/config/database');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDatabase();

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

startServer();