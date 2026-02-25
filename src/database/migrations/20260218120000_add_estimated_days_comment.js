/**
 * Add comment to estimated_days column in ContractItemMachine
 * Documents the column as "Estimated Days" (aligned with UI label in Section 5)
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    const hasColumn = await knex.schema.hasColumn('ContractItemMachine', 'estimated_days');
    if (hasColumn) {
        await knex.raw("ALTER TABLE ContractItemMachine MODIFY COLUMN estimated_days DECIMAL(10,2) NULL COMMENT 'Estimated Days'");
    }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
    const hasColumn = await knex.schema.hasColumn('ContractItemMachine', 'estimated_days');
    if (hasColumn) {
        await knex.raw("ALTER TABLE ContractItemMachine MODIFY COLUMN estimated_days DECIMAL(10,2) NULL");
    }
};
