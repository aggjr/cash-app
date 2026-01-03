-- User Management System Migration
-- Adds fields for password reset, activation, and user invitation tracking

-- Update users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS password_reset_required BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS password_reset_token VARCHAR(255) NULL,
ADD COLUMN IF NOT EXISTS password_reset_expires DATETIME NULL,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS invited_by INT NULL,
ADD COLUMN IF NOT EXISTS invited_at TIMESTAMP NULL;

-- Update project_users table
ALTER TABLE project_users 
ADD COLUMN IF NOT EXISTS invited_by INT NULL,
ADD COLUMN IF NOT EXISTS invited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS joined_at TIMESTAMP NULL,
ADD COLUMN IF NOT EXISTS status ENUM('pending', 'active', 'inactive') DEFAULT 'active';

-- Add index for token lookups
CREATE INDEX IF NOT EXISTS idx_password_reset_token ON users(password_reset_token);

-- Add foreign key for invited_by in users
ALTER TABLE users 
ADD CONSTRAINT fk_users_invited_by 
FOREIGN KEY (invited_by) REFERENCES users(id) 
ON DELETE SET NULL;

-- Add foreign key for invited_by in project_users
ALTER TABLE project_users 
ADD CONSTRAINT fk_project_users_invited_by 
FOREIGN KEY (invited_by) REFERENCES users(id) 
ON DELETE SET NULL;
