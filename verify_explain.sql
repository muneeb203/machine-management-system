-- verify_explain.sql
USE embroidery_erp;

SELECT '1. Production Date Range (ProductionEntry):' AS '';
EXPLAIN SELECT * FROM ProductionEntry WHERE ProductionDate = '2026-01-20';

SELECT '\n2. Daily Production Master Date Range:' AS '';
EXPLAIN SELECT * FROM daily_production_master WHERE production_date = '2026-01-20';

SELECT '\n3. Contract Status Filter (Contract):' AS '';
EXPLAIN SELECT * FROM Contract WHERE status = 'active' AND is_temp = 0;

SELECT '\n4. GatePass Date Filter:' AS '';
EXPLAIN SELECT * FROM GatePass WHERE PassDate = '2026-01-20';

SELECT '\n5. Clipping Status Filter:' AS '';
EXPLAIN SELECT * FROM ClippingItem WHERE Status = 'Sent';
