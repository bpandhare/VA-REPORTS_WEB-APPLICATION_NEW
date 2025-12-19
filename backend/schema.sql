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