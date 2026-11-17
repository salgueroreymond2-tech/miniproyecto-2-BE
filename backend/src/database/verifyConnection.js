'use strict';

require('dotenv').config();

const { checkDatabaseConnection, closePool } = require('../config/database');

async function main() {
  const status = await checkDatabaseConnection();
  console.log(JSON.stringify(status, null, 2));

  if (!status.connected) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(closePool);
