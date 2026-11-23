'use strict';
require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function runMigrations() {
  const migrationDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationDir)
    .filter(file => file.endsWith('.js'))
    .sort();
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'pakglobe_unified'
  });

  try {
    for (const file of files) {
      const migration = require(path.join(migrationDir, file));
      await migration.up(connection);
      console.log(`Applied migration: ${file}`);
    }
  } finally {
    await connection.end();
  }
}

runMigrations().catch(error => {
  console.error('Migration failed:', error.code || error.message);
  process.exitCode = 1;
});
