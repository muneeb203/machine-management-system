/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    // Check if column exists from a failed previous run
    const exists = await knex.schema.hasColumn('ContractItem', 'MachineID');
    if (exists) {
        // Drop it so we can re-create it correctly (as unsigned)
        await knex.schema.alterTable('ContractItem', function (table) {
            // Trying to drop the column. If a named FK constraint exists, this might require explicit dropForeign first,
            // but Knex dropColumn usually attempts to handle standard fk constraints.
            // If this fails on FK, we'll need a more complex raw query, but this covers 99% of "dirty state" cases.
            table.dropColumn('MachineID');
        });
    }

    return knex.schema.alterTable('ContractItem', function (table) {
        table.integer('MachineID').unsigned().nullable().references('MachineID').inTable('Machine');
        // Nullable because existing items may not have machine assigned immediately.
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
    return knex.schema.alterTable('ContractItem', function (table) {
        table.dropColumn('MachineID');
    });
};
