
/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    const hasStatus = await knex.schema.hasColumn('Contract', 'status');
    const hasLastUpdated = await knex.schema.hasColumn('Contract', 'last_updated_at');

    await knex.schema.alterTable('Contract', function (table) {
        if (!hasStatus) {
            table.enum('status', ['draft', 'active', 'completed', 'cancelled']).defaultTo('active');
        }
        if (!hasLastUpdated) {
            table.datetime('last_updated_at').nullable();
        }
    });

    // Backfill if needed (handled by default 'active')
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
    // We generally don't drop columns in prod to avoid data loss, but for completeness:
    // await knex.schema.alterTable('Contract', function(table) {
    //   table.dropColumn('status');
    //   table.dropColumn('last_updated_at');
    // });
};
