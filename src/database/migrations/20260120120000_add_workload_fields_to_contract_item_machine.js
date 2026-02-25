/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
    return knex.schema.alterTable('ContractItemMachine', function (table) {
        table.decimal('pending_stitches', 14, 2).notNullable().defaultTo(0.00);
        table.string('status').defaultTo('Open'); // 'Open', 'Completed', 'Overproduced'
        table.timestamp('completed_at').nullable();
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
    return knex.schema.alterTable('ContractItemMachine', function (table) {
        table.dropColumn('pending_stitches');
        table.dropColumn('status');
        table.dropColumn('completed_at');
    });
};
