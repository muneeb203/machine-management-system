/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    // 1. Create ContractItemMachine table (idempotent)
    const hasTable = await knex.schema.hasTable('ContractItemMachine');
    if (!hasTable) {
        await knex.schema.createTable('ContractItemMachine', function (table) {
            table.increments('id').primary();
            table.integer('ContractItemID').notNullable().references('ContractItemID').inTable('ContractItem').onDelete('CASCADE');
            table.integer('MachineID').unsigned().notNullable().references('MachineID').inTable('Machine');
            // Ensure one machine is assigned to an item only once (though logic allows multiple machines per item, each machine should be unique per item)
            table.unique(['ContractItemID', 'MachineID']);
            table.timestamps(true, true);
        });
    }

    // 2. Drop MachineID from ContractItem (if it exists)
    const hasCol = await knex.schema.hasColumn('ContractItem', 'MachineID');
    if (hasCol) {
        // Drop FK first if needed? Knex dropColumn usually handles it if simple, but let's be safe if it fails.
        // Drop FK first to avoid constraint errors
        await knex.schema.alterTable('ContractItem', function (table) {
            table.dropForeign('MachineID'); // Knex infers FK name usually, or we can use array ['MachineID']
            table.dropColumn('MachineID');
        });
    }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
    return knex.schema.dropTableIfExists('ContractItemMachine')
        .then(() => {
            return knex.schema.alterTable('ContractItem', function (table) {
                table.integer('MachineID').unsigned().nullable().references('MachineID').inTable('Machine');
            });
        });
};
