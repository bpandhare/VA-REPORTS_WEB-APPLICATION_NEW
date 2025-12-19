-- Migration script to add employee_id, dob, and role columns to users table
-- Run this if your users table is missing these columns

USE vickhardth_ops;

-- Add employee_id column if it doesn't exist
SET @dbname = DATABASE();
SET @tablename = 'users';
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
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' VARCHAR(80)')
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

-- Add foreign key constraint for manager_id (only if manager_id column was just added)
SET @fk_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = @dbname
    AND TABLE_NAME = @tablename
    AND CONSTRAINT_NAME = 'fk_manager'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);

IF @fk_exists = 0 THEN
  SET @sql = CONCAT(
    'ALTER TABLE ', @tablename, ' ',
    'ADD CONSTRAINT fk_manager ',
    'FOREIGN KEY (manager_id) REFERENCES ', @tablename, '(id) ',
    'ON DELETE SET NULL'
  );
  PREPARE stmt FROM @sql;
  EXECUTE stmt;
  DEALLOCATE PREPARE stmt;
  SELECT 'Foreign key constraint added for manager_id' AS message;
END IF;

-- Update existing users to have employee_id (if they don't have one)
UPDATE users 
SET employee_id = CONCAT('EMP', LPAD(id, 3, '0'))
WHERE employee_id IS NULL OR employee_id = '';

SELECT CONCAT('Updated ', ROW_COUNT(), ' users with employee IDs') AS update_message;

-- Add report_date column to daily_target_reports table
SET @tablename = 'daily_target_reports';

-- Add report_date column
SET @columnname = 'report_date';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (TABLE_SCHEMA = @dbname)
      AND (TABLE_NAME = @tablename)
      AND (COLUMN_NAME = @columnname)
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' DATE NOT NULL DEFAULT CURDATE()')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Display final status
SELECT 'Migration completed successfully!' AS result;
SELECT 
  'Users table now has:' AS table_info,
  COUNT(*) AS total_users,
  SUM(CASE WHEN employee_id IS NOT NULL THEN 1 ELSE 0 END) AS users_with_employee_id,
  SUM(CASE WHEN role IS NOT NULL THEN 1 ELSE 0 END) AS users_with_role,
  SUM(CASE WHEN dob IS NOT NULL THEN 1 ELSE 0 END) AS users_with_dob
FROM users;