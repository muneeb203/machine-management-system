-- ================================
-- Add Tilla and Sequence to ContractItem
-- ================================

ALTER TABLE ContractItem ADD COLUMN Tilla INT DEFAULT 0;
ALTER TABLE ContractItem ADD COLUMN Sequence INT DEFAULT 0;
