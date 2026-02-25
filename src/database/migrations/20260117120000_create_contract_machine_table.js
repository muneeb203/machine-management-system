
exports.up = function (knex) {
    return knex.schema.hasTable('ContractMachine').then(function (exists) {
        if (!exists) {
            return knex.schema.createTable('ContractMachine', function (table) {
                table.increments('ContractMachineID').primary();
                table.integer('ContractID').unsigned().notNullable().references('ContractID').inTable('Contract').onDelete('CASCADE');
                table.integer('MachineID').unsigned().notNullable().references('MachineID').inTable('Machine').onDelete('CASCADE');
                table.unique(['ContractID', 'MachineID']); // Prevent duplicate assignments
                table.timestamps(true, true);
            });
        }
    });
};

exports.down = function (knex) {
    return knex.schema.dropTableIfExists('ContractMachine');
};
