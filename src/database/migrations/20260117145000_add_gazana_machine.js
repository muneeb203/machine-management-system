
exports.up = function (knex) {
    return knex.schema.table('Machine', function (table) {
        table.string('gazana_machine').nullable();
    });
};

exports.down = function (knex) {
    return knex.schema.table('Machine', function (table) {
        table.dropColumn('gazana_machine');
    });
};
