
exports.up = function (knex) {
    return knex.schema.table('Contract', function (table) {
        table.date('ContractEndDate').nullable();
        table.integer('ContractDuration').nullable();
    });
};

exports.down = function (knex) {
    return knex.schema.table('Contract', function (table) {
        table.dropColumn('ContractEndDate');
        table.dropColumn('ContractDuration');
    });
};
