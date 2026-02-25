-- create_indexes.sql
-- Run this against the embroidery_erp database.
-- Recommended: BACKUP DB first (mysqldump).

-- ===========================
-- INDEX CREATION (primary - simple CREATE INDEX)
-- ===========================

-- Production
CREATE INDEX idx_productionentry_productiondate ON ProductionEntry (ProductionDate);
CREATE INDEX idx_dailyproduction_productiondate ON daily_production_master (production_date);

-- Contracts
CREATE INDEX idx_contract_status_is_temp ON Contract (status, is_temp);
-- NOTE: idx_contractitem_collection ON ContractItem (`Collection`) already exists.
-- NOTE: idx_contractitem_designno ON ContractItem (DesignNo) already exists.

-- GatePass
CREATE INDEX idx_gatepass_passdate ON GatePass (PassDate);

-- Billing
-- NOTE: Index on bill(bill_date) already exists as table.index('bill_date').

-- Clipping
CREATE INDEX idx_clippingitem_status ON ClippingItem (Status);

-- ===========================
-- ONLINE INDEX CREATION (Alternative for large tables)
-- ===========================
-- ALTER TABLE ProductionEntry ADD INDEX idx_productionentry_productiondate (ProductionDate) ALGORITHM=INPLACE, LOCK=NONE;
-- ALTER TABLE daily_production_master ADD INDEX idx_dailyproduction_productiondate (production_date) ALGORITHM=INPLACE, LOCK=NONE;
-- ALTER TABLE Contract ADD INDEX idx_contract_status_is_temp (status, is_temp) ALGORITHM=INPLACE, LOCK=NONE;
-- ALTER TABLE GatePass ADD INDEX idx_gatepass_passdate (PassDate) ALGORITHM=INPLACE, LOCK=NONE;
-- ALTER TABLE ClippingItem ADD INDEX idx_clippingitem_status (Status) ALGORITHM=INPLACE, LOCK=NONE;

-- ===========================
-- ROLLBACK (DROP INDEX)
-- ===========================
-- DROP INDEX idx_productionentry_productiondate ON ProductionEntry;
-- DROP INDEX idx_dailyproduction_productiondate ON daily_production_master;
-- DROP INDEX idx_contract_status_is_temp ON Contract;
-- DROP INDEX idx_gatepass_passdate ON GatePass;
-- DROP INDEX idx_clippingitem_status ON ClippingItem;
