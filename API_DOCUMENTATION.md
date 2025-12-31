# Embroidery ERP API Documentation

## Authentication

All API endpoints require authentication via JWT token in the Authorization header:
```
Authorization: Bearer <jwt_token>
```

### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "admin123"
}
```

Response:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "admin",
    "email": "admin@example.com",
    "role": "admin"
  }
}
```

## Core Business Workflow APIs

### 1. Contract Management

#### Create Contract
```http
POST /api/contracts
Content-Type: application/json

{
  "contractNumber": "CT-2024-001",
  "partyName": "ABC Textiles",
  "poNumber": "PO-12345",
  "startDate": "2024-01-01",
  "endDate": "2024-12-31",
  "collectionName": "Spring Collection"
}
```

#### Create Design
```http
POST /api/contracts/1/designs
Content-Type: application/json

{
  "designNumber": "D-001",
  "component": "Front",
  "repeatType": "yards",
  "repeatValue": 12,
  "plannedQuantity": 1000,
  "plannedStitchCount": 50000,
  "rateElements": [
    {
      "rateElementId": 1,
      "isSelected": true
    },
    {
      "rateElementId": 2,
      "isSelected": false
    }
  ]
}
```

### 2. Production Management

#### Create Production Entry
```http
POST /api/production/entry
Content-Type: application/json

{
  "machineId": 1,
  "designId": 1,
  "productionDate": "2024-01-15",
  "shift": "day",
  "actualStitches": 48000,
  "genuineStitches": 50000,
  "repeatsCompleted": 10,
  "operatorName": "John Doe",
  "notes": "Good quality production"
}
```

#### Bulk Production Entry
```http
POST /api/production/bulk
Content-Type: application/json

{
  "entries": [
    {
      "machineId": 1,
      "designId": 1,
      "productionDate": "2024-01-15",
      "shift": "day",
      "actualStitches": 48000,
      "repeatsCompleted": 10,
      "operatorName": "John Doe"
    },
    {
      "machineId": 2,
      "designId": 2,
      "productionDate": "2024-01-15",
      "shift": "day",
      "actualStitches": 52000,
      "repeatsCompleted": 12,
      "operatorName": "Jane Smith"
    }
  ]
}
```

#### Override Stitch Count
```http
POST /api/production/override-stitch
Content-Type: application/json

{
  "productionEntryId": 1,
  "newStitches": 45000,
  "reason": "Machine calibration issue - actual count verified manually"
}
```

### 3. Billing Management

#### Get Daily Billing
```http
GET /api/billing/daily/2024-01-15
```

Response:
```json
{
  "data": [
    {
      "id": 1,
      "contract_id": 1,
      "machine_id": 1,
      "billing_date": "2024-01-15",
      "shift": "day",
      "total_stitches": 48000,
      "base_rate": 0.001,
      "element_rates": 0.0002,
      "effective_rate": 0.0012,
      "total_amount": 57.60,
      "is_approved": false
    }
  ]
}
```

#### Approve Billing Record
```http
POST /api/billing/approve/1
```

### 4. Gate Pass Management

#### Create Gate Pass
```http
POST /api/gate-passes
Content-Type: application/json

{
  "gatePassNumber": "GP-2024-001",
  "partyName": "ABC Textiles",
  "poNumber": "PO-12345",
  "contractId": 1,
  "passType": "in",
  "totalGazana": 500.50,
  "passDate": "2024-01-15"
}
```

#### Finalize Gate Pass
```http
PUT /api/gate-passes/1/finalize
```

### 5. Reports

#### Dashboard Statistics
```http
GET /api/reports/dashboard
```

#### Machine Production Report
```http
GET /api/reports/machine-production?startDate=2024-01-01&endDate=2024-01-31
```

#### Contract Profitability
```http
GET /api/reports/contract-profitability?startDate=2024-01-01&endDate=2024-01-31
```

#### Audit Trail
```http
GET /api/reports/audit-trail?page=1&limit=50&tableName=production_entries&action=override
```

## Rate Engine APIs

### Get Rate Elements
```http
GET /api/admin/rate-elements
```

### Create/Update Rate Element
```http
POST /api/admin/rate-elements
Content-Type: application/json

{
  "name": "Sequence Work",
  "description": "Additional rate for sequence embroidery",
  "ratePerStitch": 0.0003,
  "isActive": true
}
```

### Set Base Rate
```http
POST /api/admin/base-rates
Content-Type: application/json

{
  "ratePerStitch": 0.0012,
  "effectiveFrom": "2024-02-01"
}
```

## Error Responses

All API endpoints return consistent error responses:

```json
{
  "error": {
    "message": "Validation failed",
    "code": "VALIDATION_ERROR",
    "details": [
      {
        "field": "contractNumber",
        "message": "Contract number is required"
      }
    ]
  }
}
```

### Common Error Codes
- `VALIDATION_ERROR` (400): Request validation failed
- `UNAUTHORIZED` (401): Authentication required
- `FORBIDDEN` (403): Insufficient permissions
- `NOT_FOUND` (404): Resource not found
- `DUPLICATE_RESOURCE` (409): Resource already exists
- `INTERNAL_ERROR` (500): Server error

## Rate Calculation Logic

### Effective Rate Calculation
```
Effective Rate = Base Rate + Sum(Selected Rate Elements)
```

### Billing Amount Calculation
```
Total Amount = Actual Stitches × Effective Rate
```

### Example Calculation
```
Base Rate: 0.001 per stitch
Selected Elements:
- Borer: 0.0002 per stitch
- Sequence: 0.0003 per stitch

Effective Rate = 0.001 + 0.0002 + 0.0003 = 0.0015 per stitch
Actual Stitches = 50,000
Total Amount = 50,000 × 0.0015 = $75.00
```

## Business Rules Enforced by API

### Contract → Production → Billing Flow
1. Contracts must exist before designs can be created
2. Designs must exist before production entries
3. Production entries automatically generate billing records
4. Billing records are immutable once approved

### Stitch Override Rules
1. Cannot override approved billing records
2. All overrides require mandatory reason
3. Overrides automatically recalculate billing
4. Full audit trail maintained

### Gate Pass Rules
1. Cannot finalize with incomplete production
2. Finalization triggers billing completion
3. Inventory movements tracked automatically

### Data Integrity Rules
1. No hard deletes (soft delete only)
2. All changes logged in audit trail
3. Billing records immutable after approval
4. Rate snapshots preserved at time of billing