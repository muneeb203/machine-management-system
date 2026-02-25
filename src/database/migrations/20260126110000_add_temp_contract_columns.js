
exports.up = async function (knex) {
    // 1) Add is_temp flag & metadata to Contract
    const hasContract = await knex.schema.hasTable('Contract');
    if (hasContract) {
        await knex.schema.alterTable('Contract', function (table) {
            table.boolean('is_temp').notNullable().defaultTo(0);
            table.integer('temp_created_by').nullable();
            table.timestamp('temp_created_at').nullable();
            table.string('temp_code', 100).nullable();
        });
    }

    // 2) Add is_temp flag & metadata to ContractItem
    const hasContractItem = await knex.schema.hasTable('ContractItem');
    if (hasContractItem) {
        await knex.schema.alterTable('ContractItem', function (table) {
            table.boolean('is_temp').notNullable().defaultTo(0);
            table.string('temp_reason', 255).nullable();
        });
    }
};

exports.down = async function (knex) {
    const hasContract = await knex.schema.hasTable('Contract');
    if (hasContract) {
        await knex.schema.alterTable('Contract', function (table) {
            table.dropColumn('is_temp');
            table.dropColumn('temp_created_by');
            table.dropColumn('temp_created_at');
            table.dropColumn('temp_code');
        });
    }

    const hasContractItem = await knex.schema.hasTable('ContractItem');
    if (hasContractItem) {
        await knex.schema.alterTable('ContractItem', function (table) {
            table.dropColumn('is_temp');
            table.dropColumn('temp_reason');
        });
    }
};
