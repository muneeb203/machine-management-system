
exports.up = function (knex) {
    return knex.schema.table('ContractItem', function (table) {
        table.renameColumn('Rate', 'Rate_per_Repeat');
    });
};

exports.down = function (knex) {
    return knex.schema.table('ContractItem', function (table) {
        table.renameColumn('Rate_per_Repeat', 'Rate');
    });
};
