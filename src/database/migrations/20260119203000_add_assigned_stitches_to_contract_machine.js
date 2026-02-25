/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    const hasColumn = await knex.schema.hasColumn('ContractItemMachine', 'assigned_stitches');
    if (!hasColumn) {
        await knex.schema.alterTable('ContractItemMachine', function (table) {
            table.decimal('assigned_stitches', 14, 2).notNullable().defaultTo(0);
        });
    }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
    return knex.schema.alterTable('ContractItemMachine', function (table) {
        table.dropColumn('assigned_stitches');
    });
};
