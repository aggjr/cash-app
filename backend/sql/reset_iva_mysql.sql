-- ============================================================================
-- IVA KNOWLEDGE RESET - MySQL Component
-- ============================================================================
-- This script resets IVA-related fields in the MySQL database
-- Run this AFTER running the Qdrant reset script
-- ============================================================================

-- Reset last_iva_access for all users
UPDATE users 
SET last_iva_access = NULL 
WHERE last_iva_access IS NOT NULL;

-- Verify reset
SELECT 
    COUNT(*) as total_users,
    SUM(CASE WHEN last_iva_access IS NULL THEN 1 ELSE 0 END) as users_with_null_access,
    SUM(CASE WHEN last_iva_access IS NOT NULL THEN 1 ELSE 0 END) as users_with_access
FROM users;

-- Expected result: users_with_null_access should equal total_users
