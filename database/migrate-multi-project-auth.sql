-- Multi-Project Authentication Migration
-- Move passwords from users table to project_users table

-- Step 1: Add password column to project_users
ALTER TABLE project_users 
ADD COLUMN password VARCHAR(255) NULL AFTER user_id,
ADD COLUMN password_reset_required BOOLEAN DEFAULT FALSE AFTER password;

-- Step 2: Migrate existing passwords from users to project_users
UPDATE project_users pu
INNER JOIN users u ON pu.user_id = u.id
SET pu.password = u.password,
    pu.password_reset_required = COALESCE(u.password_reset_required, FALSE);

-- Step 3: Make password NOT NULL (all records should have password now)
ALTER TABLE project_users
MODIFY COLUMN password VARCHAR(255) NOT NULL;

-- Step 4: Remove password-related columns from users table
ALTER TABLE users
DROP COLUMN password,
DROP COLUMN password_reset_required,
DROP COLUMN password_reset_token,
DROP COLUMN password_reset_expires;

-- Verification query
SELECT 
    u.email,
    p.name as project_name,
    pu.role,
    LENGTH(pu.password) as password_length,
    pu.password_reset_required
FROM project_users pu
INNER JOIN users u ON pu.user_id = u.id
INNER JOIN projects p ON pu.project_id = p.id
ORDER BY u.email, p.name;
