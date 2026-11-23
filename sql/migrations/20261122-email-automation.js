'use strict';

async function up(connection) {
  const [settingsColumns] = await connection.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'settings'`
  );
  const existing = new Set(settingsColumns.map(column => column.COLUMN_NAME));
  if (!existing.has('email_recipients')) {
    await connection.query('ALTER TABLE settings ADD COLUMN email_recipients JSON NULL AFTER catalog_options');
  }
  if (!existing.has('email_automation_enabled')) {
    await connection.query('ALTER TABLE settings ADD COLUMN email_automation_enabled TINYINT(1) NOT NULL DEFAULT 1 AFTER email_recipients');
  }

  const [quotationColumns] = await connection.query(
    `SELECT COLUMN_TYPE FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'quotations' AND COLUMN_NAME = 'status'`
  );
  if (quotationColumns[0] && !String(quotationColumns[0].COLUMN_TYPE).includes("'closed'")) {
    await connection.query(
      "ALTER TABLE quotations MODIFY status ENUM('pending','in_process','approved','rejected','cancelled','closed') DEFAULT 'pending'"
    );
  }

  const [componentColumns] = await connection.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'quotations'`
  );
  if (!componentColumns.some(column => column.COLUMN_NAME === 'component_statuses')) {
    await connection.query('ALTER TABLE quotations ADD COLUMN component_statuses JSON NULL AFTER status');
  }

  const [emailColumns] = await connection.query(
    `SELECT COLUMN_TYPE FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'scheduled_emails' AND COLUMN_NAME = 'status'`
  );
  if (emailColumns[0] && !String(emailColumns[0].COLUMN_TYPE).includes("'skipped'")) {
    await connection.query("ALTER TABLE scheduled_emails MODIFY status ENUM('queued','sent','failed','skipped') DEFAULT 'queued'");
  }
}

module.exports = { up };
