'use strict';
require('dotenv').config();
const mysql = require('mysql2/promise');
const fs    = require('fs');
const path  = require('path');

async function runSchema() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

  const conn = await mysql.createConnection({
    host:               process.env.DB_HOST || 'localhost',
    port:               parseInt(process.env.DB_PORT) || 3306,
    user:               process.env.DB_USER || 'root',
    password:           process.env.DB_PASS || '',
    multipleStatements: true
  });

  console.log('✅  Connected to MySQL');
  await conn.query(sql);

  // Apply every MySQL migration in deterministic order. This keeps a fresh
  // database identical to an already migrated installation.
  const migrationDir = path.join(__dirname, 'migrations');
  const migrations = fs.readdirSync(migrationDir)
    .filter(file => file.endsWith('.js'))
    .sort();
  for (const file of migrations) {
    await require(path.join(migrationDir, file)).up(conn);
    console.log(`Applied migration: ${file}`);
  }
  console.log('✅  Schema applied — database pakglobe_unified is ready!');
  console.log('');
  console.log('Default login credentials:');
  console.log('  Username: superadmin  |  Password: password');
  console.log('  Username: admin       |  Password: password');
  console.log('  Username: user        |  Password: password');
  console.log('');
  console.log('⚠️  Change all passwords after first login!');
  await conn.end();
}

runSchema().catch(err => {
  console.error('❌  Schema error:', err.code, err.sqlMessage || err.message, err);
  process.exit(1);
});
