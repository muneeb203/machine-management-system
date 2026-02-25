
exports.up = function (knex) {
    return knex.schema.table('ContractItem', function (table) {
        table.decimal('Rate_per_Stitch', 14, 4).nullable();
        table.decimal('Calculated_Rate', 14, 4).nullable();
        // Modify Stitch to be decimal/numeric if it's currently text, 
        // or just ensure it holds numeric values. 
        // Knex .alter() support varies by DB, mostly okay for MySQL.
        table.decimal('Stitch', 14, 2).alter();
    });
};

exports.down = function (knex) {
    return knex.schema.table('ContractItem', function (table) {
        table.dropColumn('Rate_per_Stitch');
        table.dropColumn('Calculated_Rate');
        table.string('Stitch').alter(); // Revert to string/text if that was the original
    });
};
