const { Knex } = require('knex');

/**
 * @param {Knex} knex
 */
exports.up = async function (knex) {
    // 1. Create ClippingVendors Table
    await knex.schema.createTable('ClippingVendors', (table) => {
        table.increments('id').primary();
        table.string('vendor_name').notNullable();
        table.string('contact_number').notNullable().unique();
        table.string('cnic').nullable();
        table.string('address').nullable();
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());
    });

    // 2. Add VendorID to Clipping Table
    await knex.schema.table('Clipping', (table) => {
        table.integer('VendorID').unsigned().nullable().references('id').inTable('ClippingVendors').onDelete('RESTRICT'); // Foreign Key
    });

    // 3. Migrate Existing Vendors (Optional but recommended to prevent data loss or disconnection)
    // Find distinct existing vendors from Clipping
    const uniqueVendors = await knex('Clipping')
        .distinct('VendorName', 'ContactNumber', 'CNIC', 'Address')
        .whereNotNull('VendorName');

    for (const v of uniqueVendors) {
        if (v.VendorName) {
            // Check if exists
            let vendor = await knex('ClippingVendors').where('contact_number', v.ContactNumber).first();
            let vendorId;

            if (!vendor) {
                // Insert
                const [id] = await knex('ClippingVendors').insert({
                    vendor_name: v.VendorName,
                    contact_number: v.ContactNumber || `UNK-${Date.now()}`, // Handle missing contact
                    cnic: v.CNIC,
                    address: v.Address
                });
                vendorId = id;
            } else {
                vendorId = vendor.id;
            }

            // Update Clipping records
            await knex('Clipping')
                .where({ VendorName: v.VendorName, ContactNumber: v.ContactNumber })
                .update({ VendorID: vendorId });
        }
    }
};

/**
 * @param {Knex} knex
 */
exports.down = async function (knex) {
    await knex.schema.table('Clipping', (table) => {
        table.dropColumn('VendorID');
    });
    await knex.schema.dropTable('ClippingVendors');
};
