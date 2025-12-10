USE cash_db;

-- Add destination_account_id to retiradas to support internal transfers
-- Using a stored procedure to avoid errors if column already exists
DELIMITER //

CREATE PROCEDURE AddDestinationAccountColumn()
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = 'cash_db' 
        AND TABLE_NAME = 'retiradas' 
        AND COLUMN_NAME = 'destination_account_id'
    ) THEN
        ALTER TABLE retiradas 
        ADD COLUMN destination_account_id INT NULL AFTER account_id,
        ADD CONSTRAINT fk_retiradas_destination FOREIGN KEY (destination_account_id) REFERENCES contas(id);
    END IF;
END //

DELIMITER ;

CALL AddDestinationAccountColumn();
DROP PROCEDURE AddDestinationAccountColumn;
