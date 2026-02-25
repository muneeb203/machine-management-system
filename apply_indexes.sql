-- apply_indexes.sql
USE embroidery_erp;

-- 1. ProductionEntry(ProductionDate)
SET @count = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = 'embroidery_erp' AND table_name = 'ProductionEntry' AND index_name = 'idx_productionentry_productiondate');
SET @sql = IF(@count = 0, 'CREATE INDEX idx_productionentry_productiondate ON ProductionEntry (ProductionDate)', 'SELECT "Index idx_productionentry_productiondate already exists"');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2. daily_production_master(production_date)
SET @count = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = 'embroidery_erp' AND table_name = 'daily_production_master' AND index_name = 'idx_dailyproduction_productiondate');
SET @sql = IF(@count = 0, 'CREATE INDEX idx_dailyproduction_productiondate ON daily_production_master (production_date)', 'SELECT "Index idx_dailyproduction_productiondate already exists"');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3. Contract(status, is_temp)
SET @count = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = 'embroidery_erp' AND table_name = 'Contract' AND index_name = 'idx_contract_status_is_temp');
SET @sql = IF(@count = 0, 'CREATE INDEX idx_contract_status_is_temp ON Contract (status, is_temp)', 'SELECT "Index idx_contract_status_is_temp already exists"');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 4. GatePass(PassDate)
SET @count = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = 'embroidery_erp' AND table_name = 'GatePass' AND index_name = 'idx_gatepass_passdate');
SET @sql = IF(@count = 0, 'CREATE INDEX idx_gatepass_passdate ON GatePass (PassDate)', 'SELECT "Index idx_gatepass_passdate already exists"');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 5. ClippingItem(Status)
SET @count = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = 'embroidery_erp' AND table_name = 'ClippingItem' AND index_name = 'idx_clippingitem_status');
SET @sql = IF(@count = 0, 'CREATE INDEX idx_clippingitem_status ON ClippingItem (Status)', 'SELECT "Index idx_clippingitem_status already exists"');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Verification
SHOW INDEX FROM ProductionEntry;
SHOW INDEX FROM daily_production_master;
SHOW INDEX FROM Contract;
SHOW INDEX FROM GatePass;
SHOW INDEX FROM ClippingItem;
