/**
 * Performance Optimization Migration
 * Adds targeted indexes to production, contracts, gatepass, and clipping tables.
 * 
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    const dbName = knex.client.config.connection.database;

    const addIndexIfNotExists = async (tableName, indexName, columns) => {
        const [{ count }] = await knex('information_schema.statistics')
            .where({
                TABLE_SCHEMA: dbName,
                TABLE_NAME: tableName,
                INDEX_NAME: indexName,
            })
            .count('* as count');

        if (count === 0) {
            console.log(`Adding index ${indexName} to ${tableName}...`);
            return knex.schema.alterTable(tableName, function (table) {
                if (Array.isArray(columns)) {
                    table.index(columns, indexName);
                } else {
                    table.index([columns], indexName);
                }
            });
        } else {
            console.log(`Index ${indexName} already exists on ${tableName}. Skipping.`);
        }
    };

    // 1. ProductionEntry(ProductionDate)
    await addIndexIfNotExists('ProductionEntry', 'idx_productionentry_productiondate', 'ProductionDate');

    // 2. daily_production_master(production_date)
    await addIndexIfNotExists('daily_production_master', 'idx_dailyproduction_productiondate', 'production_date');

    // 3. Contract(status, is_temp)
    await addIndexIfNotExists('Contract', 'idx_contract_status_is_temp', ['status', 'is_temp']);

    // 4. GatePass(PassDate)
    await addIndexIfNotExists('GatePass', 'idx_gatepass_passdate', 'PassDate');

    // 5. ClippingItem(Status)
    await addIndexIfNotExists('ClippingItem', 'idx_clippingitem_status', 'Status');

    // Note: ContractItem(Collection, DesignNo) and bill(bill_date) already have indexes 
    // from previous migrations or original schema.
};

/**
 * Rollback: Remove performance indexes.
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
    return knex.schema
        .alterTable('ProductionEntry', (table) => table.dropIndex([], 'idx_productionentry_productiondate'))
        .alterTable('daily_production_master', (table) => table.dropIndex([], 'idx_dailyproduction_productiondate'))
        .alterTable('Contract', (table) => table.dropIndex([], 'idx_contract_status_is_temp'))
        .alterTable('GatePass', (table) => table.dropIndex([], 'idx_gatepass_passdate'))
        .alterTable('ClippingItem', (table) => table.dropIndex([], 'idx_clippingitem_status'));
};
