
/**
 * Migration to rename Yard to GazanaContract and Gazana to GazanaCost in ContractItem table
 */
exports.up = function (knex) {
    return knex.schema.table('ContractItem', function (table) {
        // Rename existing columns
        // Note: Knex renameColumn might depend on DB driver support.
        // For SQLite/MySQL which this likely is (based on db connection file implied), it should work.

        // Rename 'Yard' -> 'GazanaContract'
        table.renameColumn('Yard', 'GazanaContract');

        // Rename 'Gazana' -> 'GazanaCost'
        table.renameColumn('Gazana', 'GazanaCost');
    });
};

exports.down = function (knex) {
    return knex.schema.table('ContractItem', function (table) {
        // Revert renames
        table.renameColumn('GazanaContract', 'Yard');
        table.renameColumn('GazanaCost', 'Gazana');
    });
};
