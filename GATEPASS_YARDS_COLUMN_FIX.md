# Gate Pass Yards Column Fix

## Issue
When creating a gate pass, the system was throwing an error:
```
Unknown column 'Yards' in 'field list'
```

This occurred because the code was trying to insert data into a `Yards` column that didn't exist in the `GatePassItem` table.

## Root Cause
There was a migration file to rename the `Gazana` column to `Yards`, but it was located in the wrong directory:
- **Wrong location**: `src/server/db/migrations/20260120_rename_gazana_to_yards.js`
- **Correct location**: `src/database/migrations/`

The knex configuration (`knexfile.js`) points to `./src/database/migrations`, so migrations in other directories are not executed.

## Solution

### 1. Created New Migration
Created a properly named migration file in the correct location:
- **File**: `src/database/migrations/20260205160000_rename_gazana_to_yards_gatepass.js`
- **Purpose**: Renames `Gazana` column to `Yards` in `GatePassItem` table

### 2. Migration Content
```javascript
exports.up = function (knex) {
    return knex.schema.table('GatePassItem', function (table) {
        table.renameColumn('Gazana', 'Yards');
    });
};

exports.down = function (knex) {
    return knex.schema.table('GatePassItem', function (table) {
        table.renameColumn('Yards', 'Gazana');
    });
};
```

### 3. Executed Migration
Ran the migration using:
```bash
npx knex migrate:latest
```

Result: `Batch 46 run: 1 migrations` - Successfully executed

## Verification

The `GatePassItem` table now has the `Yards` column instead of `Gazana`, which matches what the code expects when inserting gate pass items.

### Code References
The gate pass routes (`src/server/routes/gatePasses.ts`) insert items with:
```typescript
Yards: item.yards || 0
```

This now works correctly with the updated database schema.

## Additional Fix: TypeScript Error

### Issue
The server was failing to start due to a TypeScript compilation error in `src/services/workload.ts`:
```
error TS2304: Cannot find name 'avgDays'
```

### Solution
Added the missing variable declaration:
```typescript
const avgDays = Number(assignment.avg_days || 0);
```

This variable is used to determine if a contract item machine assignment is delayed.

## Status
✅ Database schema updated  
✅ Migration executed successfully  
✅ TypeScript error fixed  
✅ Server can now start without errors  
✅ Gate pass creation should work correctly

## Testing
To verify the fix works:
1. Start the server
2. Navigate to Gate Passes module
3. Create a new gate pass with items
4. Verify no "Unknown column 'Yards'" error occurs
5. Verify gate pass is created successfully
