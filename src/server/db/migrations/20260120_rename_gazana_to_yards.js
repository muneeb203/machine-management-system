
exports.up = function (knex) {
    return knex.schema.table('GatePassItem', function (table) {
        table.renameColumn('Gazana', 'Yards');
    });
};

exports.down = function (knex) {
    return knex.schema.table('GatePassItem', function (table) {
        table.renameColumn('Yards', 'Gazana');
    });
};
