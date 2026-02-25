
exports.up = function (knex) {
    return knex.schema.alterTable('Machine', function (table) {
        table.integer('master_machine_number').nullable();
    }).then(function () {
        return knex.schema.alterTable('ProductionEntry', function (table) {
            // Denormalized for reporting clarity as requested
            table.integer('master_machine_number').nullable();
        });
    });
};

exports.down = function (knex) {
    return knex.schema.alterTable('Machine', function (table) {
        table.dropColumn('master_machine_number');
    }).then(function () {
        return knex.schema.alterTable('ProductionEntry', function (table) {
            table.dropColumn('master_machine_number');
        });
    });
};
