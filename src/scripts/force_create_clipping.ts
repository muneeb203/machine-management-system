
import db from '../database/connection';

async function createClippingTables() {
    try {
        console.log("Checking Clipping tables...");

        const hasClipping = await db.schema.hasTable('Clipping');
        if (!hasClipping) {
            console.log("Creating Clipping table...");
            await db.schema.createTable('Clipping', function (table) {
                table.increments('ClippingID').primary();
                table.string('VendorName', 255).notNullable();
                table.string('ContactNumber', 50).notNullable();
                table.string('CNIC', 50).notNullable();
                table.text('Address').nullable();
                table.timestamp('CreatedAt').defaultTo(db.fn.now());
                table.timestamp('UpdatedAt').defaultTo(db.fn.now());
            });
            console.log("Clipping table created.");
        } else {
            console.log("Clipping table already exists.");
        }

        const hasClippingItem = await db.schema.hasTable('ClippingItem');
        if (!hasClippingItem) {
            console.log("Creating ClippingItem table...");
            await db.schema.createTable('ClippingItem', function (table) {
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
            console.log("ClippingItem table created.");
        } else {
            console.log("ClippingItem table already exists.");
        }

        console.log("Done.");
        process.exit(0);
    } catch (error) {
        console.error("Error creating tables:", error);
        process.exit(1);
    }
}

createClippingTables();
