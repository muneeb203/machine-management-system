/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
    return knex.schema.alterTable('daily_billing_records', function (table) {
        table.integer('contract_id').nullable().after('master_id');
        table.foreign('contract_id').references('ContractID').inTable('Contract');
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
    return knex.schema.alterTable('daily_billing_records', function (table) {
        table.dropForeign(['contract_id']);
        table.dropColumn('contract_id');
    });
};
