-- ============================================================
--  PAK GLOBE TRAVELS — UNIFIED PLATFORM — MYSQL SCHEMA
--  Database: pakglobe_unified
--  Version:  1.0.0  |  Date: November 2026
--  Run once on a fresh MySQL 8.0+ server
-- ============================================================

CREATE DATABASE IF NOT EXISTS pakglobe_unified
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE pakglobe_unified;

-- ─────────────────────────────────────────────────────────────
-- TABLE 1: BRANCHES
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS branches (
  id              VARCHAR(36)  PRIMARY KEY DEFAULT (UUID()),
  name            VARCHAR(100) NOT NULL,
  code            VARCHAR(10),
  phone           VARCHAR(20),
  email           VARCHAR(100),
  address         TEXT,
  license_no      VARCHAR(50),
  logo_url        VARCHAR(500),
  brand_color     VARCHAR(7)   DEFAULT '#7EC8E3',
  invoice_prefix  VARCHAR(10)  DEFAULT 'PGT',
  invoice_next    INT          DEFAULT 1,
  default_roe     DECIMAL(10,2) DEFAULT 78.00,
  settings        JSON,
  status          ENUM('active','inactive') DEFAULT 'active',
  created_at      DATETIME     DEFAULT NOW(),
  updated_at      DATETIME     DEFAULT NOW() ON UPDATE NOW()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────────────────────────
-- TABLE 2: USERS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id              VARCHAR(36)  PRIMARY KEY DEFAULT (UUID()),
  username        VARCHAR(50)  UNIQUE NOT NULL,
  password        VARCHAR(255) NOT NULL,
  full_name       VARCHAR(100) NOT NULL,
  email           VARCHAR(100),
  phone           VARCHAR(20),
  role            ENUM('superadmin','admin','branch_admin','editor','viewer','user') DEFAULT 'user',
  branch_id       VARCHAR(36),
  status          ENUM('active','inactive') DEFAULT 'active',
  permissions     JSON,
  last_login      DATETIME,
  created_at      DATETIME     DEFAULT NOW(),
  updated_at      DATETIME     DEFAULT NOW() ON UPDATE NOW(),
  INDEX idx_username  (username),
  INDEX idx_branch    (branch_id),
  INDEX idx_role      (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────────────────────────
-- TABLE 3: HOTELS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hotels (
  id                  VARCHAR(36)  PRIMARY KEY DEFAULT (UUID()),
  name                VARCHAR(200) NOT NULL,
  name_normalized     VARCHAR(200),
  city                VARCHAR(50)  NOT NULL,
  country             VARCHAR(50)  DEFAULT 'Saudi Arabia',
  area                VARCHAR(100),
  distance_text       VARCHAR(100),
  distance_meters     INT          DEFAULT 0,
  stars               TINYINT      DEFAULT 0,
  shuttle             TINYINT(1)   DEFAULT 0,
  status              ENUM('active','inactive') DEFAULT 'active',
  description         TEXT,
  amenities           TEXT,
  image_url           VARCHAR(500),
  location_url        VARCHAR(1000),
  images              JSON,
  branch_visibility   JSON,
  dedup_key           VARCHAR(60),
  created_by          VARCHAR(36),
  created_at          DATETIME     DEFAULT NOW(),
  updated_at          DATETIME     DEFAULT NOW() ON UPDATE NOW(),
  deleted_at          DATETIME,
  INDEX idx_city          (city),
  INDEX idx_status        (status),
  INDEX idx_dedup         (dedup_key),
  INDEX idx_name_norm     (name_normalized(100)),
  FULLTEXT idx_search     (name, city, area)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────────────────────────
-- TABLE 4: HOTEL_VENDORS  (Vendor Rate Contracts)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hotel_vendors (
  id              VARCHAR(36)  PRIMARY KEY DEFAULT (UUID()),
  hotel_id        VARCHAR(36)  NOT NULL,
  vendor_name     VARCHAR(100) NOT NULL,
  room_type       VARCHAR(50)    DEFAULT 'DOUBLE',
  meal_plan       VARCHAR(20)  DEFAULT 'RO',
  price_all       DECIMAL(10,2) DEFAULT 0,
  price_weekday   DECIMAL(10,2) DEFAULT 0,
  price_weekend   DECIMAL(10,2) DEFAULT 0,
  price_best      DECIMAL(10,2) DEFAULT 0,
  extra_bed       DECIMAL(10,2) DEFAULT 0,
  days_type       ENUM('ALL','WEEKDAY','WEEKEND','SPLIT') DEFAULT 'ALL',
  checkin_date    DATE,
  checkout_date   DATE,
  remarks         TEXT,
  status          ENUM('active','inactive') DEFAULT 'active',
  created_at      DATETIME     DEFAULT NOW(),
  updated_at      DATETIME     DEFAULT NOW() ON UPDATE NOW(),
  FOREIGN KEY (hotel_id) REFERENCES hotels(id) ON DELETE CASCADE,
  INDEX idx_hotel         (hotel_id),
  INDEX idx_vendor        (vendor_name),
  INDEX idx_room_type     (room_type),
  INDEX idx_dates         (checkin_date, checkout_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────────────────────────
-- TABLE 5: VENDORS  (Master Supplier List)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vendors (
  id          VARCHAR(36)  PRIMARY KEY DEFAULT (UUID()),
  name        VARCHAR(100) UNIQUE NOT NULL,
  phone       VARCHAR(20),
  email       VARCHAR(100),
  whatsapp    VARCHAR(20),
  address     TEXT,
  status      ENUM('active','inactive') DEFAULT 'active',
  created_at  DATETIME     DEFAULT NOW(),
  updated_at  DATETIME     DEFAULT NOW() ON UPDATE NOW()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────────────────────────
-- TABLE 6: SETTINGS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settings (
  id                    INT PRIMARY KEY AUTO_INCREMENT,
  scope                 ENUM('global','branch') DEFAULT 'global',
  branch_id             VARCHAR(36),
  company_name          VARCHAR(100),
  phone                 VARCHAR(20),
  email                 VARCHAR(100),
  address               TEXT,
  whatsapp              VARCHAR(20),
  license_no            VARCHAR(50),
  logo_url              VARCHAR(500),
  global_margin         DECIMAL(10,2) DEFAULT 0,
  room_margins          JSON,
  default_roe           DECIMAL(10,2) DEFAULT 78.00,
  default_visa_adult    DECIMAL(10,2) DEFAULT 560,
  default_visa_child    DECIMAL(10,2) DEFAULT 560,
  default_visa_infant   DECIMAL(10,2) DEFAULT 150,
  invoice_prefix        VARCHAR(10)   DEFAULT 'PGT',
  invoice_next          INT           DEFAULT 1,
  brand_color           VARCHAR(7)    DEFAULT '#7EC8E3',
  terms_text            TEXT,
  disclaimer_text       TEXT,
  filter_perms          JSON,
  tagline               VARCHAR(200),
  city_order            VARCHAR(20)    DEFAULT 'makkah_first',
  default_meal          VARCHAR(100)   DEFAULT 'BB',
  default_duration      SMALLINT       DEFAULT 15,
  session_timeout       INT            DEFAULT 480,
  wa_quote_template     TEXT,
  wa_followup_template  TEXT,
  catalog_options       JSON,
  updated_at            DATETIME      DEFAULT NOW() ON UPDATE NOW(),
  UNIQUE KEY uq_scope_branch (scope, branch_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────────────────────────
-- TABLE 7: QUERIES  (Hotel Booking Queries)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS queries (
  id                  VARCHAR(36)  PRIMARY KEY DEFAULT (UUID()),
  ref_code            VARCHAR(20)  UNIQUE,
  client_name         VARCHAR(100),
  client_phone        VARCHAR(20),
  hotel_id            VARCHAR(36),
  hotel_name          VARCHAR(200),
  rooms_requested     JSON,
  checkin_date        DATE,
  checkout_date       DATE,
  guest_names         TEXT,
  notes               TEXT,
  status              ENUM('new','checking_rates','checking_avail','confirm_whatsapp','quote_sent','booked','closed') DEFAULT 'new',
  supplier_confirmed  TINYINT(1)   DEFAULT 0,
  booking_ref         VARCHAR(100),
  submitted_by        VARCHAR(36),
  branch_id           VARCHAR(36),
  workflow_history    JSON,
  created_at          DATETIME     DEFAULT NOW(),
  updated_at          DATETIME     DEFAULT NOW() ON UPDATE NOW(),
  INDEX idx_status    (status),
  INDEX idx_branch    (branch_id),
  INDEX idx_ref       (ref_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────────────────────────
-- TABLE 8: QUOTATIONS  (Umrah Package Costing)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quotations (
  id              VARCHAR(36)  PRIMARY KEY DEFAULT (UUID()),
  invoice_no      VARCHAR(30)  UNIQUE,
  type            ENUM('private','group') NOT NULL,
  client_name     VARCHAR(100),
  contact_no      VARCHAR(20),
  travel_dates    VARCHAR(100),
  includes        VARCHAR(200),
  status          ENUM('pending','in_process','approved','rejected','cancelled') DEFAULT 'pending',
  adult_pax       TINYINT      DEFAULT 0,
  child_pax       TINYINT      DEFAULT 0,
  infant_pax      TINYINT      DEFAULT 0,
  options         JSON,
  shares          JSON,
  created_by      VARCHAR(36),
  branch_id       VARCHAR(36),
  branch_name     VARCHAR(100),
  created_at      DATETIME     DEFAULT NOW(),
  updated_at      DATETIME     DEFAULT NOW() ON UPDATE NOW(),
  deleted_at      DATETIME,
  INDEX idx_type        (type),
  INDEX idx_status      (status),
  INDEX idx_branch      (branch_id),
  INDEX idx_created_by  (created_by),
  FULLTEXT idx_search   (client_name, invoice_no, contact_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────────────────────────
-- TABLE 9: TRANSPORT
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transport (
  id          VARCHAR(36)   PRIMARY KEY DEFAULT (UUID()),
  sector      VARCHAR(100)  NOT NULL,
  vehicle     VARCHAR(100)  NOT NULL,
  rate_sar    DECIMAL(10,2) DEFAULT 0,
  rate_pkr    DECIMAL(10,2) DEFAULT 0,
  status      ENUM('active','inactive') DEFAULT 'active',
  created_at  DATETIME      DEFAULT NOW(),
  updated_at  DATETIME      DEFAULT NOW() ON UPDATE NOW()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────────────────────────
-- TABLE 10: HOTELS_MASTER  (Costing Dropdown List)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hotels_master (
  id      VARCHAR(36)  PRIMARY KEY DEFAULT (UUID()),
  city    ENUM('makkah','madina','jeddah') NOT NULL,
  name    VARCHAR(200) NOT NULL,
  stars   TINYINT      DEFAULT 0,
  area    VARCHAR(100),
  INDEX idx_city (city)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────────────────────────
-- TABLE 11: IMAGES  (Uploaded file registry)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS images (
  id              VARCHAR(36)  PRIMARY KEY DEFAULT (UUID()),
  filename        VARCHAR(255) NOT NULL,
  original_name   VARCHAR(255),
  file_path       VARCHAR(500) NOT NULL,
  public_url      VARCHAR(500) NOT NULL,
  file_size       INT,
  mime_type       VARCHAR(50),
  linked_to       VARCHAR(36),
  linked_type     ENUM('hotel','branch','quotation','logo','other') DEFAULT 'other',
  uploaded_by     VARCHAR(36),
  created_at      DATETIME     DEFAULT NOW()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────────────────────────
-- TABLE 12: AUDIT_LOGS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id          BIGINT       AUTO_INCREMENT PRIMARY KEY,
  user_id     VARCHAR(36),
  username    VARCHAR(50),
  action      VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id   VARCHAR(36),
  details     JSON,
  ip_address  VARCHAR(45),
  created_at  DATETIME     DEFAULT NOW(),
  INDEX idx_user      (user_id),
  INDEX idx_action    (action),
  INDEX idx_created   (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────────────────────────
-- TABLE 13: RECYCLE_BIN
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recycle_bin (
  id              VARCHAR(36)  PRIMARY KEY DEFAULT (UUID()),
  entity_type     ENUM('hotel','quotation','vendor','branch','user') NOT NULL,
  entity_id       VARCHAR(36)  NOT NULL,
  entity_name     VARCHAR(200),
  data_snapshot   JSON,
  deleted_by      VARCHAR(36),
  branch_id       VARCHAR(36),
  expires_at      DATETIME,
  created_at      DATETIME     DEFAULT NOW(),
  INDEX idx_expires   (expires_at),
  INDEX idx_type      (entity_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────────────────────────
-- TABLE 14: BACKUPS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS backups (
  id          VARCHAR(36)  PRIMARY KEY DEFAULT (UUID()),
  backup_type ENUM('manual','daily','weekly') DEFAULT 'manual',
  file_path   VARCHAR(500),
  file_size   BIGINT,
  created_by  VARCHAR(36),
  created_at  DATETIME     DEFAULT NOW()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ═══════════════════════════════════════════════════════════
--  SEED DATA
-- ═══════════════════════════════════════════════════════════

-- Global Settings
INSERT IGNORE INTO settings (scope, company_name, phone, email, address,
  invoice_prefix, invoice_next, default_roe, default_visa_adult,
  default_visa_child, default_visa_infant, brand_color,
  terms_text, disclaimer_text)
VALUES (
  'global',
  'Pak Globe Travels',
  '03100376111',
  'info@pakglobetravels.com',
  'Office # A/03, Upper Side of Broadway Pizza, Autobhan Road, Hyderabad',
  'PGT', 1, 78.00, 560.00, 560.00, 150.00, '#7EC8E3',
  '1. All rates are subject to availability.\n2. Visa approval subject to Saudi MOFA rules.\n3. Package rates valid at time of quotation only.',
  'Rates are indicative. Final confirmation subject to supplier availability.'
);

-- Default Head-Office Branch
INSERT IGNORE INTO branches (id, name, code, phone, email, invoice_prefix, default_roe, status)
VALUES (
  'branch-head-office-00000001',
  'Head Office — Hyderabad',
  'HO',
  '03100376111',
  'info@pakglobetravels.com',
  'PGT',
  78.00,
  'active'
);

-- Default Users
-- superadmin  / super123
-- admin       / admin123
-- user        / user123
INSERT IGNORE INTO users (id, username, password, full_name, role, status) VALUES
(
  'user-superadmin-00000001',
  'superadmin',
  '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
  'Super Admin',
  'superadmin',
  'active'
),
(
  'user-admin-000000000001',
  'admin',
  '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
  'Shahzaman (Admin)',
  'admin',
  'active'
),
(
  'user-staff-000000000001',
  'user',
  '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
  'Staff User',
  'user',
  'active'
);

-- Default Makkah/Madina Hotels for Costing
INSERT IGNORE INTO hotels_master (city, name, stars, area) VALUES
('makkah','Swissotel Al Maqam',5,'Abraj Al-Bait'),
('makkah','Fairmont Makkah Clock Royal Tower',5,'Abraj Al-Bait'),
('makkah','Conrad Makkah',5,'Al Zahra'),
('makkah','Marriott Hotel Al Forsan',5,'Al Zahra'),
('makkah','Hilton Suites Makkah',5,'Ibrahim Khalil'),
('makkah','Millennium Hotel Makkah',5,'Ibrahim Khalil'),
('makkah','Al Zahra Ajyad',4,'Ajyad'),
('makkah','Anjum Hotel Makkah',5,'Ibrahim Khalil'),
('makkah','Makkah Hotel & Towers',4,'Ajyad'),
('makkah','Al Naseem Hotel',3,'Aziziyah'),
('madina','Anwar Al Madinah Mövenpick',5,'Central Area'),
('madina','Hilton Madinah',5,'Central Area'),
('madina','Marriott Madinah',5,'Central Area'),
('madina','Sheraton Al Haram Hotel Madinah',5,'Central Area'),
('madina','Dallah Taibah Hotel',4,'Central Area'),
('madina','Al Eiman Taibah Hotel',4,'Central Area'),
('madina','Oberoi Madinah',5,'Central Area');

-- Default Transport Routes
INSERT IGNORE INTO transport (sector, vehicle, rate_sar, rate_pkr) VALUES
('JED-MAK',           'GMC (4 TO 7 PERSON)',  800,  0),
('JED-MAK',           'COASTER (14-20 PAX)',   1800, 0),
('JED-MAK',           'BUS (45+ PAX)',         3500, 0),
('JED-MAK-MED-JED',   'GMC (4 TO 7 PERSON)',  2200, 0),
('JED-MAK-MED-JED',   'COASTER (14-20 PAX)',   4500, 0),
('JED-MAK-MED-JED',   'BUS (45+ PAX)',         8000, 0),
('MAK-MED',           'GMC (4 TO 7 PERSON)',  1200, 0),
('MAK-MED',           'COASTER (14-20 PAX)',   2800, 0),
('MED-JED',           'GMC (4 TO 7 PERSON)',  1200, 0),
('MED-JED',           'COASTER (14-20 PAX)',   2800, 0),
('LOCAL-MAK-ZIYARAT', 'GMC (4 TO 7 PERSON)',  600,  0),
('LOCAL-MED-ZIYARAT', 'GMC (4 TO 7 PERSON)',  500,  0);

-- ═══════════════════════════════════════════════════════════
--  VERIFY
-- ═══════════════════════════════════════════════════════════
-- SELECT table_name, table_rows FROM information_schema.tables
-- WHERE table_schema = 'pakglobe_unified';
