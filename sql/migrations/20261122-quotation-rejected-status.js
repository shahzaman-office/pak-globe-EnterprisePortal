'use strict';

module.exports = {
  async up(db) {
    await db.execute(
      `ALTER TABLE quotations MODIFY COLUMN status
       ENUM('pending','in_process','approved','rejected','cancelled') DEFAULT 'pending'`
    );
  }
};
