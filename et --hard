'use strict';

async function up(connection) {
  const [hotelColumns] = await connection.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'hotels'`
  );
  if (!hotelColumns.some(column => column.COLUMN_NAME === 'location_url')) {
    await connection.query('ALTER TABLE hotels ADD COLUMN location_url VARCHAR(1000) NULL AFTER image_url');
  }

  const [settingsColumns] = await connection.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'settings'`
  );
  const existing = new Set(settingsColumns.map(column => column.COLUMN_NAME));
  const additions = {
    tagline: 'VARCHAR(200) NULL',
    city_order: "VARCHAR(20) DEFAULT 'makkah_first'",
    default_meal: "VARCHAR(100) DEFAULT 'BB'",
    default_duration: 'SMALLINT DEFAULT 15',
    session_timeout: 'INT DEFAULT 480',
    wa_quote_template: 'TEXT NULL',
    wa_followup_template: 'TEXT NULL',
    catalog_options: 'JSON NULL'
  };

  for (const [name, definition] of Object.entries(additions)) {
    if (!existing.has(name)) {
      await connection.query(`ALTER TABLE settings ADD COLUMN ${name} ${definition}`);
    }
  }

  const [roomTypeColumns] = await connection.query(
    `SELECT DATA_TYPE FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'hotel_vendors'
       AND COLUMN_NAME = 'room_type'`
  );
  if (roomTypeColumns[0]?.DATA_TYPE === 'enum') {
    await connection.query(
      "ALTER TABLE hotel_vendors MODIFY room_type VARCHAR(50) DEFAULT 'DOUBLE'"
    );
  }
}

module.exports = { up };
