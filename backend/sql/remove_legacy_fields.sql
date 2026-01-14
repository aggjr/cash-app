-- Remove legacy IVA fields from users table
-- Run this script in your MySQL client

ALTER TABLE users DROP COLUMN preferred_name;
ALTER TABLE users DROP COLUMN gender;
