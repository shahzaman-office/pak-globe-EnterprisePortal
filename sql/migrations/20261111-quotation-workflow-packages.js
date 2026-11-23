'use strict';

module.exports = {
  async up(db) {
    const statements = [
      `ALTER TABLE users ADD COLUMN department VARCHAR(50) NULL AFTER phone`,
      `ALTER TABLE quotations ADD COLUMN approved_at DATETIME NULL AFTER status`,
      `ALTER TABLE quotations ADD COLUMN approved_by VARCHAR(36) NULL AFTER approved_at`,
      `CREATE TABLE IF NOT EXISTS quotation_packages (
        id VARCHAR(36) PRIMARY KEY,
        quotation_id VARCHAR(36) NULL,
        client_name VARCHAR(150) NOT NULL,
        branch_id VARCHAR(36) NULL,
        visa_rate DECIMAL(12,2) DEFAULT 0, visa_qty INT DEFAULT 0,
        ticket_rate DECIMAL(12,2) DEFAULT 0, ticket_qty INT DEFAULT 0,
        transport_rate DECIMAL(12,2) DEFAULT 0, transport_qty INT DEFAULT 0,
        hotel_amount DECIMAL(12,2) DEFAULT 0, other_amount DECIMAL(12,2) DEFAULT 0,
        total_amount DECIMAL(12,2) DEFAULT 0, received_amount DECIMAL(12,2) DEFAULT 0,
        remaining_amount DECIMAL(12,2) DEFAULT 0,
        notes TEXT, created_by VARCHAR(36), created_at DATETIME DEFAULT NOW(), updated_at DATETIME DEFAULT NOW() ON UPDATE NOW(),
        INDEX idx_package_branch (branch_id), INDEX idx_package_client (client_name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      `ALTER TABLE quotation_packages ADD COLUMN details JSON NULL AFTER notes`,
      `CREATE TABLE IF NOT EXISTS package_payments (
        id VARCHAR(36) PRIMARY KEY, package_id VARCHAR(36) NOT NULL,
        amount DECIMAL(12,2) NOT NULL, received_on DATE NOT NULL, method VARCHAR(50), note VARCHAR(255),
        created_by VARCHAR(36), created_at DATETIME DEFAULT NOW(), INDEX idx_payment_package (package_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      `CREATE TABLE IF NOT EXISTS scheduled_emails (
        id VARCHAR(36) PRIMARY KEY,
        quotation_id VARCHAR(36) NOT NULL,
        department VARCHAR(50) NOT NULL,
        recipient_email VARCHAR(150) NOT NULL,
        subject VARCHAR(255) NOT NULL,
        html_body TEXT NOT NULL,
        event_date DATE NULL,
        scheduled_for DATETIME NOT NULL,
        sent_at DATETIME NULL,
        status ENUM('queued','sent','failed') DEFAULT 'queued',
        error_message VARCHAR(500) NULL,
        created_at DATETIME DEFAULT NOW(),
        UNIQUE KEY uq_scheduled_email (quotation_id, department, recipient_email, event_date),
        INDEX idx_scheduled_email_due (status, scheduled_for)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    ];
    for (const sql of statements) {
      try { await db.execute(sql); } catch (error) {
        if (error.code !== 'ER_DUP_FIELDNAME') throw error;
      }
    }
  }
};
