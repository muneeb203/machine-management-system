# Optimized Billing Page Implementation Specification

## Executive Summary

Replace the current Daily Billing UI with an optimized Billing Editor featuring a matrix-style layout matching the Weavetex sample invoice. Support multi-variant (fabric) columns per design, accurate formulas, proper DB mappings, and export to PDF & Excel.

---

## 1. Database Schema & Migrations

### 1.1 Tables Used
- **bill**: Main bill header table
- **bill_item**: Individual line items (one row per fabric variant)

### 1.2 Required bill_item Columns

**Existing columns to keep:**
- `bill_item_id` (PK)
- `bill_id` (FK to bill)
- `design_no` (varchar)
- `collection` (varchar)
- `component` (varchar)
- `item_description` (text)
- `stitches` (decimal)
- `rate_per_unit` (decimal) - rename to `rate_stitch`
- `amount` (decimal)
- `created_at`, `updated_at`

**New columns to add:**
- `fabric` (varchar, 50) - Fabric type/name (e.g., "ORG", "POLY")
- `yards` (decimal 10,2) - Fabric yards/meters
- `rate_stitch` (decimal 10,4) - Rate per stitch
- `rate_per_yds` (decimal 10,2) - Rate per yard/meter
- `rate_repeat` (decimal 10,2) - Rate per repeat
- `repeats` (decimal 10,2) - Number of repeats
- `pieces` (int) - Number of pieces
- `wte_ogp` (varchar, 100) - WTE OGP reference number
- `h2h_po` (varchar, 100) - H2H PO reference number
- `formula_details` (json) - Calculation audit trail

### 1.3 Migration File

**File**: `src/database/migrations/20260206000000_add_billing_matrix_fields.js`

```javascript
exports.up = async function(knex) {
  // Check if columns exist before adding
  const hasColumns = await knex.schema.hasColumn('bill_item', 'fabric');
  
  if (!hasColumns) {
    await knex.schema.table('bill_item', (table) => {
      table.string('fabric', 50).nullable();
      table.decimal('yards', 10, 2).nullable();
      table.decimal('rate_stitch', 10, 4).nullable();
      table.decimal('rate_per_yds', 10, 2).nullable();
      table.decimal('rate_repeat', 10, 2).nullable();
      table.decimal('repeats', 10, 2).nullable();
      table.integer('pieces').nullable();
      table.string('wte_ogp', 100).nullable();
      table.string('h2h_po', 100).nullable();
      table.json('formula_details').nullable();
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.table('bill_item', (table) => {
    table.dropColumn('fabric');
    table.dropColumn('yards');
    table.dropColumn('rate_stitch');
    table.dropColumn('rate_per_yds');
    table.dropColumn('rate_repeat');
    table.dropColumn('repeats');
    table.dropColumn('pieces');
    table.dropColumn('wte_ogp');
    table.dropColumn('h2h_po');
    table.dropColumn('formula_details');
  });
};
```


---

## 2. Data Model & Mapping Logic

### 2.1 Matrix to Database Mapping

**Concept**: Each fabric variant column in the UI matrix = one `bill_item` row in the database.

**Example**:
```
UI Matrix:
Design: FLORAL-001
Variants: ORG (11.55 YRD) | POLY (10.00 YRD) | COTTON (12.00 YRD)

Database:
bill_item row 1: design_no='FLORAL-001', fabric='ORG', yards=11.55, ...
bill_item row 2: design_no='FLORAL-001', fabric='POLY', yards=10.00, ...
bill_item row 3: design_no='FLORAL-001', fabric='COTTON', yards=12.00, ...
```

### 2.2 Formula Details JSON Structure

Store calculation inputs and outputs for audit and recalculation:

```json
{
  "method": "HDS",
  "inputs": {
    "machine_gazana": 1200,
    "d_stitch": 104,
    "stitches_done": 50000,
    "rate": 0.85
  },
  "calculated": {
    "fabric_yards": 11.55,
    "rate_per_yds": 2.35,
    "amount": 27.14
  },
  "timestamp": "2026-02-06T10:30:00Z",
  "user_overrides": {
    "amount": false
  }
}
```

### 2.3 Grouping Logic

- **Design Group**: Items with same `design_no` and `collection`
- **Variant**: Unique combination of `design_no` + `fabric`
- **Display Order**: Group by design, then by fabric alphabetically
