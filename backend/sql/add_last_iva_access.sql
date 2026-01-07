-- Add last_iva_access column to users table
-- Run this SQL directly in your database

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS last_iva_access TIMESTAMP NULL;
