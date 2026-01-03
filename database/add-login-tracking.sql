-- Add last_login_at to project_users for tracking most recent access
ALTER TABLE project_users
ADD COLUMN last_login_at DATETIME NULL AFTER joined_at;

-- Initialize existing records with joined_at or current timestamp
UPDATE project_users
SET last_login_at = COALESCE(joined_at, NOW())
WHERE last_login_at IS NULL;
