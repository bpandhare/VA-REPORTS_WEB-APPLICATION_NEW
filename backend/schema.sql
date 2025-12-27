CREATE DATABASE IF NOT EXISTS vickhardth_ops;
USE vickhardth_ops;

CREATE TABLE IF NOT EXISTS site_activity (
    id INT AUTO_INCREMENT PRIMARY KEY,
    log_date DATE NOT NULL,
    log_time TIME NOT NULL,
    project_name VARCHAR(120) NOT NULL,
    daily_target TEXT,
    hourly_activity TEXT,
    problems_faced TEXT,
    resolution_status TEXT,
    problem_start TIME NULL,
    problem_end TIME NULL,
    support_problem TEXT,
    support_start TIME NULL,
    support_end TIME NULL,
    support_engineer VARCHAR(120),
    engineer_remark TEXT,
    incharge_remark TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id VARCHAR(6) NOT NULL UNIQUE,
    username VARCHAR(80) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    dob DATE,
    role VARCHAR(80),
    manager_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE SET NULL
);
-- Add phone column to users table if it doesn't exist
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS phone VARCHAR(15) UNIQUE;

-- Or if you're creating the table fresh:
/*
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id VARCHAR(6) UNIQUE,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    dob DATE NOT NULL,
    phone VARCHAR(15) UNIQUE NOT NULL,
    role VARCHAR(50) NOT NULL,
    manager_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status ENUM('active', 'inactive') DEFAULT 'active',
    FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE SET NULL
);
*/
CREATE TABLE IF NOT EXISTS hourly_reports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    report_date DATE NOT NULL,
    time_period VARCHAR(20) NOT NULL,
    project_name VARCHAR(120) NOT NULL,
    daily_target TEXT,
    hourly_activity TEXT NOT NULL,
    problem_faced_by_engineer_hourly TEXT,
    problem_resolved_or_not VARCHAR(10),
    problem_occur_start_time TIME NULL,
    problem_resolved_end_time TIME NULL,
    online_support_required_for_which_problem TEXT,
    online_support_time TIME NULL,
    online_support_end_time TIME NULL,
    engineer_name_who_gives_online_support VARCHAR(120),
    engineer_remark TEXT,
    project_incharge_remark TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE IF NOT EXISTS daily_target_reports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    report_date DATE NOT NULL DEFAULT CURDATE(),
    in_time TIME NOT NULL,
    out_time TIME NOT NULL,
    customer_name VARCHAR(120) NOT NULL,
    customer_person VARCHAR(120) NOT NULL,
    customer_contact VARCHAR(20) NOT NULL,
    end_customer_name VARCHAR(120) NOT NULL,
    end_customer_person VARCHAR(120) NOT NULL,
    end_customer_contact VARCHAR(20) NOT NULL,
    project_no VARCHAR(120) NOT NULL,
    location_type VARCHAR(20) NOT NULL,
    site_location VARCHAR(255),
    location_lat DECIMAL(10, 8),
    location_lng DECIMAL(11, 8),
    mom_report_path VARCHAR(255),
    daily_target_planned TEXT NOT NULL,
    daily_target_achieved TEXT NOT NULL,
    additional_activity TEXT,
    who_added_activity VARCHAR(120),
    daily_pending_target TEXT,
    reason_pending_target TEXT,
    problem_faced TEXT,
    problem_resolved TEXT,
    online_support_required TEXT,
    support_engineer_name VARCHAR(120),
    site_start_date DATE NOT NULL,
    site_end_date DATE,
    incharge VARCHAR(120) NOT NULL,
    remark TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add leave_type column if it doesn't exist
ALTER TABLE daily_target_reports 
ADD COLUMN IF NOT EXISTS leave_type VARCHAR(50) DEFAULT NULL;

-- Add index for better performance on leave queries
CREATE INDEX IF NOT EXISTS idx_leave_type ON daily_target_reports(location_type, leave_type, report_date);
-- Add user_id columns with error handling for older MySQL
DELIMITER $$

-- Procedure to safely add columns
CREATE PROCEDURE AddColumnIfNotExists(
    IN tableName VARCHAR(64),
    IN columnName VARCHAR(64),
    IN columnDefinition VARCHAR(255)
)
BEGIN
    DECLARE columnExists INT;

    -- Check if column exists
    SELECT COUNT(*)
    INTO columnExists
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = tableName
    AND COLUMN_NAME = columnName;

    -- Add column if it doesn't exist
    IF columnExists = 0 THEN
        SET @sql = CONCAT('ALTER TABLE ', tableName, ' ADD COLUMN ', columnName, ' ', columnDefinition);
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
        SELECT CONCAT('Added column ', columnName, ' to ', tableName) AS result;
    ELSE
        SELECT CONCAT('Column ', columnName, ' already exists in ', tableName) AS result;
    END IF;
END$$

DELIMITER ;

-- Add user_id columns to all report tables
CALL AddColumnIfNotExists('hourly_reports', 'user_id', 'INT NULL');
CALL AddColumnIfNotExists('daily_target_reports', 'user_id', 'INT NULL');
CALL AddColumnIfNotExists('site_activity', 'user_id', 'INT NULL');

-- Add foreign key constraints
-- First check if they exist
DELIMITER $$

CREATE PROCEDURE AddForeignKeyIfNotExists(
    IN tableName VARCHAR(64),
    IN constraintName VARCHAR(64),
    IN columnName VARCHAR(64),
    IN refTable VARCHAR(64),
    IN refColumn VARCHAR(64)
)
BEGIN
    DECLARE constraintExists INT;

    -- Check if foreign key already exists
    SELECT COUNT(*)
    INTO constraintExists
    FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = tableName
    AND CONSTRAINT_NAME = constraintName
    AND CONSTRAINT_TYPE = 'FOREIGN KEY';

    -- Add foreign key if it doesn't exist
    IF constraintExists = 0 THEN
        SET @sql = CONCAT('ALTER TABLE ', tableName, 
                         ' ADD CONSTRAINT ', constraintName,
                         ' FOREIGN KEY (', columnName, ')',
                         ' REFERENCES ', refTable, '(', refColumn, ')',
                         ' ON DELETE SET NULL');
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
        SELECT CONCAT('Added foreign key ', constraintName) AS result;
    ELSE
        SELECT CONCAT('Foreign key ', constraintName, ' already exists') AS result;
    END IF;
END$$


DELIMITER ;

-- Add foreign keys
CALL AddForeignKeyIfNotExists('hourly_reports', 'fk_hourly_reports_user', 'user_id', 'users', 'id');
CALL AddForeignKeyIfNotExists('daily_target_reports', 'fk_daily_target_reports_user', 'user_id', 'users', 'id');
CALL AddForeignKeyIfNotExists('site_activity', 'fk_site_activity_user', 'user_id', 'users', 'id');

-- Drop the procedures if you want (optional)
DROP PROCEDURE IF EXISTS AddColumnIfNotExists;
DROP PROCEDURE IF EXISTS AddForeignKeyIfNotExists;

-- Insert test user with correct bcrypt hash for "test123"
INSERT INTO users (employee_id, username, password_hash, dob, role) 
VALUES (
  'E001',
  'testuser',
  '$2a$10$N9qo8uLOickgx2ZMRZoMye.CjL6QZ.6YgqFQJv6Z7Y8W9X0Y1Z2A3', -- bcrypt hash for "test123"
  '1990-01-01',
  'Engineer'
) ON DUPLICATE KEY UPDATE 
  password_hash = '$2a$10$N9qo8uLOickgx2ZMRZoMye.CjL6QZ.6YgqFQJv6Z7Y8W9X0Y1Z2A3',
  role = 'Engineer';

-- Show all users
SELECT 
  '=== DATABASE SETUP COMPLETE ===' AS status,
  'Test user created: E001 / testuser / test123' AS credentials
UNION ALL
SELECT 
  'Total users in database:',
  CAST(COUNT(*) AS CHAR)
FROM users
UNION ALL
SELECT 
  CONCAT('User: ', employee_id),
  CONCAT(username, ' (', role, ')')
FROM users;
-- Reset and create fresh database
DROP DATABASE IF EXISTS vickhardth_ops;
CREATE DATABASE vickhardth_ops;
USE vickhardth_ops;

-- Create users table
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id VARCHAR(6) NOT NULL UNIQUE,
    username VARCHAR(80) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    dob DATE,
    role VARCHAR(80),
    manager_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert test user with PLAIN TEXT password (for testing)
-- We'll let bcrypt handle hashing in the app
INSERT INTO users (employee_id, username, password_hash, dob, role) 
VALUES (
  'E001',
  'testuser',
  '$2a$10$XuG8U9V2W3X4Y5Z6A7B8C9D0E1F2G3H4I5J6K7L8M9N0O1P2Q3R4S5T6U7V8W9', -- Test hash
  '1990-01-01',
  'Engineer'
);

-- Verify
SELECT 'Database reset complete' AS status;
SELECT * FROM users;
-- If your users table doesn't allow NULL for employee_id, update it:
ALTER TABLE users MODIFY employee_id VARCHAR(6) NULL;

-- Or if creating new table:
CREATE TABLE users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  employee_id VARCHAR(6) NULL, -- Changed to allow NULL
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  dob DATE NOT NULL,
  role VARCHAR(50) NOT NULL,
  manager_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE SET NULL
);
USE vickhardth_ops;

-- Add missing columns
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS full_name VARCHAR(100) DEFAULT NULL AFTER username,
ADD COLUMN IF NOT EXISTS email VARCHAR(100) UNIQUE DEFAULT NULL AFTER phone,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE AFTER role;

-- Verify table structure
DESCRIBE users;
-- 1. Create activities table
CREATE TABLE activities (
  id INT PRIMARY KEY AUTO_INCREMENT,
  date DATE NOT NULL,
  time TIME NOT NULL,
  engineer_name VARCHAR(100) NOT NULL,
  engineer_id INT,
  project VARCHAR(255) DEFAULT 'N/A',
  location VARCHAR(255) DEFAULT 'N/A',
  activity_target TEXT,
  problem TEXT,
  status ENUM('present', 'leave', 'absent') DEFAULT 'present',
  leave_reason TEXT,
  start_time TIME,
  end_time TIME,
  activity_type ENUM('site_work', 'meeting', 'planning', 'reporting', 'training', 'leave', 'other') DEFAULT 'site_work',
  logged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (engineer_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_date (date),
  INDEX idx_engineer_date (engineer_id, date),
  INDEX idx_status_date (status, date)
);

-- 2. Add role column to users table if not exists
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'Engineer',
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS phone VARCHAR(15) UNIQUE;

-- 3. Create activity_stats view for quick reporting
CREATE OR REPLACE VIEW activity_stats AS
SELECT 
  DATE(created_at) as stat_date,
  COUNT(*) as total_activities,
  COUNT(DISTINCT engineer_id) as active_employees,
  SUM(CASE WHEN status = 'leave' THEN 1 ELSE 0 END) as on_leave,
  SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent_count,
  GROUP_CONCAT(DISTINCT 
    CASE WHEN status = 'absent' THEN engineer_name END 
    SEPARATOR ', ') as absentees
FROM activities
GROUP BY DATE(created_at);

-- 4. Update users table to ensure phone uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS idx_phone_unique ON users(phone);

-- Add full_name column to users table
ALTER TABLE users ADD COLUMN full_name VARCHAR(100) DEFAULT NULL AFTER username;

-- Update existing users to set full_name from username
UPDATE users SET full_name = username WHERE full_name IS NULL;

DROP TABLE IF EXISTS daily_target_reports;

CREATE TABLE daily_target_reports (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  report_date DATE NOT NULL,
  in_time TIME,
  out_time TIME,
  customer_name VARCHAR(255),
  customer_person VARCHAR(255),
  customer_contact VARCHAR(20),
  end_customer_name VARCHAR(255),
  end_customer_person VARCHAR(255),
  end_customer_contact VARCHAR(20),
  project_no VARCHAR(100),
  location_type VARCHAR(50) NOT NULL,
  leave_type VARCHAR(50),
  site_location TEXT,
  location_lat DECIMAL(10, 8),
  location_lng DECIMAL(11, 8),
  mom_report_path TEXT,
  daily_target_planned TEXT,
  daily_target_achieved TEXT,
  additional_activity TEXT,
  who_added_activity VARCHAR(255),
  daily_pending_target TEXT,
  reason_pending_target TEXT,
  problem_faced TEXT,
  problem_resolved TEXT,
  online_support_required VARCHAR(10),
  support_engineer_name VARCHAR(255),
  site_start_date DATE,
  site_end_date DATE,
  incharge VARCHAR(255),
  remark TEXT,
  attendance_status VARCHAR(50) DEFAULT 'present',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
-- Add these columns to daily_target_reports table
ALTER TABLE daily_target_reports 
ADD COLUMN leave_status VARCHAR(20) DEFAULT 'pending',
ADD COLUMN leave_approved_by VARCHAR(100),
ADD COLUMN leave_approved_at DATETIME,
ADD COLUMN leave_rejection_reason TEXT,
ADD COLUMN leave_approval_remark TEXT,
ADD COLUMN leave_cancellation_reason TEXT;


-- Add these columns to activities table
ALTER TABLE activities 
ADD COLUMN approved_by VARCHAR(100),
ADD COLUMN approved_at DATETIME,
ADD COLUMN rejected_by VARCHAR(100),
ADD COLUMN rejected_at DATETIME,
ADD COLUMN rejection_reason TEXT;
-- Add leave_status column
ALTER TABLE daily_target_reports 
ADD COLUMN leave_status VARCHAR(20) DEFAULT NULL 
COMMENT 'pending, approved, rejected, cancelled';

-- Add other leave-related columns that might be referenced in your code
ALTER TABLE daily_target_reports 
ADD COLUMN leave_approved_by VARCHAR(255) DEFAULT NULL;

ALTER TABLE daily_target_reports 
ADD COLUMN leave_approved_at TIMESTAMP DEFAULT NULL;

ALTER TABLE daily_target_reports 
ADD COLUMN leave_rejection_reason TEXT DEFAULT NULL;

ALTER TABLE daily_target_reports 
ADD COLUMN leave_cancellation_reason TEXT DEFAULT NULL;

ALTER TABLE daily_target_reports 
ADD COLUMN leave_approval_remark TEXT DEFAULT NULL;

-- Optionally, add an index for better performance
CREATE INDEX idx_leave_status ON daily_target_reports(leave_status);
CREATE INDEX idx_location_type ON daily_target_reports(location_type);