-- Complete Migration Script for Activity Monitoring System
-- Run this script to update your database schema

USE vickhardth_ops;

-- 1. Add missing columns to users table
-- Add name column if it doesn't exist
SET @dbname = DATABASE();
SET @tablename = 'users';
SET @columnname = 'name';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (TABLE_SCHEMA = @dbname)
      AND (TABLE_NAME = @tablename)
      AND (COLUMN_NAME = @columnname)
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' VARCHAR(100) NULL')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add employee_id column if it doesn't exist
SET @columnname = 'employee_id';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (TABLE_SCHEMA = @dbname)
      AND (TABLE_NAME = @tablename)
      AND (COLUMN_NAME = @columnname)
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' VARCHAR(20) UNIQUE')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add dob column if it doesn't exist
SET @columnname = 'dob';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (TABLE_SCHEMA = @dbname)
      AND (TABLE_NAME = @tablename)
      AND (COLUMN_NAME = @columnname)
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' DATE')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add role column if it doesn't exist
SET @columnname = 'role';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (TABLE_SCHEMA = @dbname)
      AND (TABLE_NAME = @tablename)
      AND (COLUMN_NAME = @columnname)
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' VARCHAR(80) DEFAULT "Engineer"')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add manager_id column if it doesn't exist
SET @columnname = 'manager_id';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (TABLE_SCHEMA = @dbname)
      AND (TABLE_NAME = @tablename)
      AND (COLUMN_NAME = @columnname)
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' INT NULL')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add is_active column if it doesn't exist
SET @columnname = 'is_active';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (TABLE_SCHEMA = @dbname)
      AND (TABLE_NAME = @tablename)
      AND (COLUMN_NAME = @columnname)
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' BOOLEAN DEFAULT TRUE')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add phone column if it doesn't exist (ensure it's unique)
SET @columnname = 'phone';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (TABLE_SCHEMA = @dbname)
      AND (TABLE_NAME = @tablename)
      AND (COLUMN_NAME = @columnname)
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' VARCHAR(15) UNIQUE')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 2. Update existing records
-- Set name = username for existing users where name is NULL
UPDATE users SET name = username WHERE name IS NULL OR name = '';

-- Update existing users to have employee_id (if they don't have one)
UPDATE users 
SET employee_id = CONCAT('E', LPAD(id, 3, '0'))
WHERE (employee_id IS NULL OR employee_id = '') AND name IS NOT NULL;

-- Set default role for existing users
UPDATE users SET role = 'Engineer' WHERE role IS NULL OR role = '';

-- 3. Create activities table if it doesn't exist
CREATE TABLE IF NOT EXISTS activities (
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
  FOREIGN KEY (engineer_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Create indexes for performance (only if they don't exist)
CREATE INDEX IF NOT EXISTS idx_activities_date ON activities(date);
CREATE INDEX IF NOT EXISTS idx_activities_engineer_date ON activities(engineer_id, date);
CREATE INDEX IF NOT EXISTS idx_activities_status_date ON activities(status, date);

-- 5. Fix the problematic index on daily_target_reports
DROP INDEX IF EXISTS idx_leave_type ON daily_target_reports;
CREATE INDEX IF NOT EXISTS idx_leave_type ON daily_target_reports(location_type, leave_type);

-- 6. Add foreign key constraint for manager_id (only if it doesn't exist)
SET @fk_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = @dbname
    AND TABLE_NAME = @tablename
    AND CONSTRAINT_NAME = 'fk_manager'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);

IF @fk_exists = 0 THEN
  ALTER TABLE users 
  ADD CONSTRAINT fk_manager 
  FOREIGN KEY (manager_id) REFERENCES users(id) 
  ON DELETE SET NULL;
END IF;

-- 7. Add unique constraint on phone (if not exists)
SET @index_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = @dbname
    AND TABLE_NAME = @tablename
    AND INDEX_NAME = 'idx_phone_unique'
);

IF @index_exists = 0 THEN
  CREATE UNIQUE INDEX idx_phone_unique ON users(phone);
END IF;

-- 8. Display migration results
SELECT 'Migration completed successfully!' AS result;

SELECT 
  'Users table status:' AS table_info,
  COUNT(*) AS total_users,
  SUM(CASE WHEN employee_id IS NOT NULL THEN 1 ELSE 0 END) AS users_with_employee_id,
  SUM(CASE WHEN role IS NOT NULL THEN 1 ELSE 0 END) AS users_with_role,
  SUM(CASE WHEN dob IS NOT NULL THEN 1 ELSE 0 END) AS users_with_dob,
  SUM(CASE WHEN name IS NOT NULL THEN 1 ELSE 0 END) AS users_with_name,
  SUM(CASE WHEN phone IS NOT NULL THEN 1 ELSE 0 END) AS users_with_phone
FROM users;

-- Check if activities table exists
SELECT 
  'Activities table:' AS table_info,
  IF(EXISTS(SELECT * FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'activities'), 
     'Created successfully', 
     'NOT created') AS status;

-- Show tables in database
SELECT TABLE_NAME, TABLE_ROWS as 'Rows', CREATE_TIME 
FROM INFORMATION_SCHEMA.TABLES 
WHERE TABLE_SCHEMA = @dbname 
ORDER BY TABLE_NAME;
// In your database setup/init file
async function addAttendanceStatusColumn() {
  try {
    await pool.execute(`
      ALTER TABLE daily_target_reports 
      ADD COLUMN attendance_status VARCHAR(50) DEFAULT 'present'
    `);
    console.log('✅ Added attendance_status column');
  } catch (error) {
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('ℹ️ attendance_status column already exists');
    } else {
      console.error('❌ Failed to add attendance_status column:', error);
    }
  }
}

// Call this function when your app starts
addAttendanceStatusColumn();