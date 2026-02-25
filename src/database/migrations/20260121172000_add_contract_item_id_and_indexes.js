/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
    return knex.schema
        .alterTable('daily_production_master', function (table) {
            table.integer('contract_item_id').nullable().after('collection_name');
            // Foreign key constraint usually good, but depends on if we want strict integrity or lose coupling.
            // Given it's a "Master" entry which aggregates, maybe strict FK is risky if items deleted?
            // But user said "Store selectedContractItemId = ContractItemID".
            // Let's add FK for integrity but ON DELETE SET NULL to be safe.
            table.foreign('contract_item_id').references('ContractItem.ContractItemID').onDelete('SET NULL');
        })
        .then(() => {
            // Add Indexes for Search Performance
            return knex.schema.alterTable('ContractItem', function (table) {
                table.index(['Collection']);
                table.index(['DesignNo']);
                table.index(['ItemDescription']); // Might be text, check length? Usually VARCHAR(255) so OK.
            });
        })
        .then(() => {
            return knex.schema.alterTable('Contract', function (table) {
                table.index(['ContractNo']);
            });
        });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
    return knex.schema
        .alterTable('daily_production_master', function (table) {
            table.dropForeign('contract_item_id');
            table.dropColumn('contract_item_id');
        })
        .then(() => {
            return knex.schema.alterTable('ContractItem', function (table) {
                table.dropIndex(['Collection']);
                table.dropIndex(['DesignNo']);
                table.dropIndex(['ItemDescription']);
            });
        })
        .then(() => {
            return knex.schema.alterTable('Contract', function (table) {
                table.dropIndex(['ContractNo']);
            });
        });
};
