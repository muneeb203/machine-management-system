
/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    const hasGazz = await knex.schema.hasColumn('ContractItem', 'MachineGazz');
    if (!hasGazz) {
        await knex.schema.table('ContractItem', function (table) {
            table.string('MachineGazz').nullable();
        });
    }

    const hasHead = await knex.schema.hasColumn('ContractItem', 'MachineHead');
    if (!hasHead) {
        await knex.schema.table('ContractItem', function (table) {
            table.string('MachineHead').nullable();
        });
    }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
    // Should ideally drop them if we want to revert this specific fix, 
    // but if the original migration also drops them, valid.
    // We can leave this empty or drop if exists.
    return knex.schema.table('ContractItem', function (table) {
        // Intentionally left blank or use dropColumnIfExists logic if knex supported it natively easily
        // table.dropColumn('MachineGazz');
        // table.dropColumn('MachineHead');
    });
};
