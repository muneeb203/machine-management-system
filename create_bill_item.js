// Script to create bill_item table using raw SQL
require('dotenv').config();
const knex = require('knex');

const db = knex({
    client: 'mysql2',
    connection: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '3306'),
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'embroidery_erp',
    }
});

async function createTable() {
    try {
        console.log('Checking if bill_item table exists...');
        const exists = await db.schema.hasTable('bill_item');

        if (exists) {
            console.log('✅ bill_item table already exists!');
            process.exit(0);
            return;
        }

        console.log('Creating bill_item table...');

        await db.raw(`
      CREATE TABLE bill_item (
        bill_item_id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        bill_id INT UNSIGNED NOT NULL,
        design_no VARCHAR(100) NULL,
        item_description VARCHAR(255) NULL,
        qty DECIMAL(14,2) DEFAULT 0,
        stitches DECIMAL(18,2) DEFAULT 0,
        rate_per_unit DECIMAL(18,6) DEFAULT 0,
        rate_type ENUM('HDS','SHEET','FUSING') NOT NULL,
        amount DECIMAL(18,2) NOT NULL,
        formula_details JSON NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_bill_item_bill FOREIGN KEY (bill_id) REFERENCES bill(bill_id) ON DELETE CASCADE,
        INDEX idx_bill_id (bill_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

        console.log('✅ bill_item table created successfully!');
        await db.destroy();
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        await db.destroy();
        process.exit(1);
    }
}

createTable();
