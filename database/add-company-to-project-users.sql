-- Add company_id to project_users table
-- This allows each user to have a different company per project

ALTER TABLE project_users
ADD COLUMN company_id INT NULL AFTER role,
ADD CONSTRAINT fk_project_users_company
    FOREIGN KEY (company_id) REFERENCES empresas(id)
    ON DELETE SET NULL;

-- Migrate existing company_id from users table to project_users
UPDATE project_users pu
INNER JOIN users u ON pu.user_id = u.id
SET pu.company_id = u.company_id
WHERE u.company_id IS NOT NULL;

-- Verification query
SELECT 
    u.email,
    p.name as project_name,
    pu.role,
    e.name as company_name,
    pu.company_id
FROM project_users pu
INNER JOIN users u ON pu.user_id = u.id
INNER JOIN projects p ON pu.project_id = p.id
LEFT JOIN empresas e ON pu.company_id = e.id
ORDER BY u.email, p.name;
