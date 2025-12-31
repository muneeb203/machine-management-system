# Embroidery Factory ERP - Business Rules & Validation

## Core Business Workflow

### Mandatory Flow Enforcement
```
Contract → Programmer → Production → Gate Pass → Billing → Reconciliation
```

**No shortcuts allowed. Each step must be completed before proceeding to the next.**

## 1. Contract Management Rules

### Contract Creation
- ✅ Contract number must be unique across the system
- ✅ Party name is mandatory
- ✅ Start date cannot be in the past
- ✅ End date must be after start date (if provided)
- ✅ Soft delete only - no hard deletion allowed

### Design Creation
- ✅ Design number + component must be unique within a contract
- ✅ Repeat type must be either 'yards' or 'pieces'
- ✅ If repeat type is 'yards', repeat value (10 or 12) is mandatory
- ✅ Planned quantity must be positive integer
- ✅ Rate elements must be selected at design creation (snapshot rates)

## 2. Rate Engine Rules

### Rate Calculation
```
Effective Rate = Base Rate + Sum(Selected Rate Elements)
Final Bill = Actual Stitches × Effective Rate
```

### Rate Management
- ✅ Only Admin can modify rates
- ✅ Rate changes never affect past billing records
- ✅ Rates are snapshot at time of design creation
- ✅ Base rate must always be active
- ✅ Rate elements can be activated/deactivated

### Billing Rules
- ✅ Billing is 100% automated - no manual entry allowed
- ✅ Billing records are immutable once approved
- ✅ Only Admin can approve billing records
- ✅ Approved billing cannot be modified or deleted

## 3. Production Rules

### Daily Production Entry
- ✅ Machine must exist and be active
- ✅ Design must exist and be linked to active contract
- ✅ Production date cannot be future date
- ✅ Actual stitches must be non-negative
- ✅ Operator name is mandatory
- ✅ Multiple designs per machine per day allowed
- ✅ Automatic billing record creation

### Stitch Override Rules
- ✅ Cannot override stitches for approved billing records
- ✅ Reason is mandatory (minimum 5 characters)
- ✅ Override automatically recalculates billing
- ✅ Full audit trail maintained
- ✅ Original values preserved
- ✅ User and timestamp recorded

### Machine Rules
- ✅ 22 machines total (numbered 1-22)
- ✅ Grouped under 3 masters (1-8: Master 1, 9-15: Master 2, 16-22: Master 3)
- ✅ Each machine has day/night shift capacity
- ✅ Machines can be activated/deactivated

## 4. Gate Pass & Inventory Rules

### Gate Pass Creation
- ✅ Gate pass number must be unique
- ✅ Pass type must be 'in' or 'out'
- ✅ Total gazana must be positive
- ✅ Party name is mandatory
- ✅ Can be linked to contract (optional)

### Gate Pass Finalization
- ✅ Cannot finalize if linked production is incomplete
- ✅ Finalization triggers automatic billing completion
- ✅ All related production marked as billed
- ✅ Only Inventory Clerk can finalize
- ✅ Finalized gate passes cannot be modified

### Inventory Tracking
- ✅ All movements tracked in gazana (yards)
- ✅ IN movements increase inventory
- ✅ OUT movements decrease inventory
- ✅ Automatic movement creation on gate pass approval
- ✅ Inventory balance calculated in real-time

## 5. User Access Control

### Role-Based Permissions

#### Admin
- ✅ Full system access
- ✅ Rate management
- ✅ User management
- ✅ Billing approval
- ✅ System configuration

#### Programmer
- ✅ Contract and design management
- ✅ Programming assignments
- ✅ Production planning
- ✅ View reports

#### Operator
- ✅ Daily production entry
- ✅ Stitch overrides
- ✅ View production data
- ✅ Basic reporting

#### Inventory Clerk
- ✅ Gate pass management
- ✅ Inventory tracking
- ✅ Gate pass finalization
- ✅ Inventory reports

#### Auditor
- ✅ Read-only access to all data
- ✅ Audit trail access
- ✅ All reports
- ✅ No data modification

## 6. Data Integrity Rules

### Audit Trail
- ✅ All data changes logged automatically
- ✅ User, timestamp, IP address recorded
- ✅ Old and new values preserved
- ✅ No audit log deletion allowed
- ✅ Override actions specially flagged

### Soft Delete Policy
- ✅ No hard deletion of business data
- ✅ Deleted records marked with deleted_at timestamp
- ✅ Deleted records excluded from normal queries
- ✅ Audit trail preserved for deleted records

### Data Validation
- ✅ All inputs validated on both client and server
- ✅ Database constraints enforce data integrity
- ✅ Foreign key relationships maintained
- ✅ Unique constraints prevent duplicates

## 7. Billing Integrity Rules

### Immutability
- ✅ Approved billing records cannot be changed
- ✅ Database constraints prevent modification
- ✅ Audit trail tracks approval process
- ✅ Only new billing records can be created

### Automatic Generation
- ✅ Every production entry creates billing record
- ✅ No manual billing entry allowed
- ✅ Rate calculation is automatic
- ✅ Stitch overrides trigger recalculation

### Approval Workflow
- ✅ Only Admin role can approve billing
- ✅ Approval timestamp recorded
- ✅ Approved records become immutable
- ✅ Approval cannot be reversed

## 8. Reconciliation Rules

### Production vs Shipment
- ✅ System compares total production value vs shipped value
- ✅ Discrepancies automatically flagged
- ✅ Reconciliation status tracked
- ✅ Physical stock check required for discrepancies

### Gate Pass Validation
- ✅ Cannot finalize gate pass with incomplete production
- ✅ All linked production must be complete
- ✅ Billing must be generated before finalization
- ✅ Inventory movements automatically created

## 9. Reporting Rules

### Real-Time Data
- ✅ All reports show real-time data
- ✅ No cached or stale information
- ✅ Immediate reflection of changes
- ✅ Consistent data across all reports

### Access Control
- ✅ Reports filtered by user role
- ✅ Sensitive data protected
- ✅ Audit reports for Admin/Auditor only
- ✅ Production data for relevant roles

## 10. System Constraints

### Performance Rules
- ✅ Bulk operations for daily production entry
- ✅ Optimized queries for large datasets
- ✅ Indexed columns for fast searches
- ✅ Connection pooling for database

### Backup Rules
- ✅ Daily automated backups
- ✅ Backup verification required
- ✅ Point-in-time recovery capability
- ✅ Offsite backup storage

### Security Rules
- ✅ JWT token authentication
- ✅ Password hashing with bcrypt
- ✅ HTTPS required in production
- ✅ SQL injection prevention
- ✅ Input sanitization

## Validation Error Messages

### Contract Validation
- "Contract number already exists"
- "Party name is required"
- "Start date cannot be in the past"
- "End date must be after start date"

### Production Validation
- "Machine not found or inactive"
- "Design not found or inactive"
- "Production date cannot be future"
- "Actual stitches must be non-negative"
- "Operator name is required"

### Billing Validation
- "Cannot modify approved billing record"
- "Billing record not found"
- "Insufficient permissions for approval"

### Gate Pass Validation
- "Gate pass number already exists"
- "Cannot finalize with incomplete production"
- "Invalid gazana quantity"
- "Party name is required"

These business rules ensure data integrity, enforce the mandatory workflow, and maintain audit compliance throughout the system.