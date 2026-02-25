
exports.up = function (knex) {
    return knex.schema.alterTable('Machine', function (table) {
        table.string('MachineNumber', 50).alter();
    });
};

exports.down = function (knex) {
    // Creating a down migration for this is risky effectively if data is now alphanumeric, 
    // but for completeness we can try to revert if possible, or just leave it.
    // Reverting to INT would fail if we have "Machine-001". 
    // We'll skip the down migration logic for safety in this context or just comment it.
};
