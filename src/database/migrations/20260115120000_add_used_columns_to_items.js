
exports.up = function (knex) {
    return knex.schema.table('ContractItem', function (table) {
        table.decimal('UsedStitches', 14, 2).defaultTo(0);
        table.integer('UsedRepeats').defaultTo(0);
    });
};

exports.down = function (knex) {
    return knex.schema.table('ContractItem', function (table) {
        table.dropColumn('UsedStitches');
        table.dropColumn('UsedRepeats');
    });
};
