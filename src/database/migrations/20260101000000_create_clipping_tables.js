
exports.up = async function (knex) {
    const hasClipping = await knex.schema.hasTable('Clipping');
    if (!hasClipping) {
        await knex.schema.createTable('Clipping', function (table) {
            table.increments('ClippingID').primary();
            table.string('VendorName', 255).notNullable();
            table.string('ContactNumber', 50).notNullable();
            table.string('CNIC', 50).notNullable();
            table.text('Address').nullable();
            table.timestamp('CreatedAt').defaultTo(knex.fn.now());
            table.timestamp('UpdatedAt').defaultTo(knex.fn.now());
        });
    }

    const hasClippingItem = await knex.schema.hasTable('ClippingItem');
    if (!hasClippingItem) {
        await knex.schema.createTable('ClippingItem', function (table) {
            table.increments('ClippingItemID').primary();
            table.integer('ClippingID').unsigned().notNullable()
                .references('ClippingID').inTable('Clipping').onDelete('CASCADE');

            // Link to Contract Item to track progress against it
            table.integer('ContractItemID').unsigned().notNullable()
                .references('ContractItemID').inTable('ContractItem').onDelete('CASCADE');

            table.string('Description', 255).notNullable(); // work description

            table.decimal('QuantitySent', 18, 4).notNullable();
            table.date('DateSent').notNullable();

            table.decimal('QuantityReceived', 18, 4).defaultTo(0);
            table.date('LastReceivedDate').nullable();

            // Status: Sent, Partially Received, Completed
            table.string('Status', 50).defaultTo('Sent');
        });
    }
};

exports.down = function (knex) {
    return knex.schema
        .dropTableIfExists('ClippingItem')
        .dropTableIfExists('Clipping');
};
