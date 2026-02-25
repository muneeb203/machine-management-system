# Optimized Billing - Part 6: Testing & Quality Assurance

## 7. Testing Strategy

### 7.1 Unit Tests

#### 7.1.1 Formula Calculation Tests

**File**: `src/services/__tests__/billingFormulas.test.ts`

```typescript
import { calculateRatePerYard, calculateAmount, calculateFabricYards } from '../billingFormulas';

describe('Billing Formulas', () => {
  describe('calculateRatePerYard', () => {
    it('should calculate rate per yard correctly', () => {
      const result = calculateRatePerYard(104, 0.85);
      expect(result).toBeCloseTo(0.245, 3);
    });
    
    it('should handle zero rate', () => {
      const result = calculateRatePerYard(104, 0);
      expect(result).toBe(0);
    });
  });
  
  describe('calculateAmount', () => {
    it('should calculate amount from yards and rate', () => {
      const result = calculateAmount(11.55, 2.35);
      expect(result).toBeCloseTo(27.14, 2);
    });
  });
  
  describe('calculateFabricYards', () => {
    it('should calculate fabric yards from machine data', () => {
      const result = calculateFabricYards(1200, 104, 50000);
      expect(result).toBeCloseTo(576.92, 2);
    });
  });
});
```

#### 7.1.2 Validation Tests

```typescript
describe('Bill Validation', () => {
  it('should reject bill without party name', () => {
    const bill = { party_name: '', bill_date: '2026-02-06', items: [] };
    expect(validateBill(bill)).toHaveProperty('errors.party_name');
  });
  
  it('should reject bill without items', () => {
    const bill = { party_name: 'ABC', bill_date: '2026-02-06', items: [] };
    expect(validateBill(bill)).toHaveProperty('errors.items');
  });
  
  it('should reject item with negative stitches', () => {
    const item = { stitches: -100, rate_stitch: 0.85 };
    expect(validateBillItem(item)).toHaveProperty('errors.stitches');
  });
});
```

### 7.2 Integration Tests

#### 7.2.1 Bill Creation Test

```typescript
describe('POST /api/bills', () => {
  it('should create bill with multiple variants', async () => {
    const billData = {
      header: {
        party_name: 'Test Party',
        bill_date: '2026-02-06',
        collection: 'Summer 2024'
      },
      items: [
        { fabric: 'ORG', yards: 11.55, stitches: 50000, rate_stitch: 0.85, amount: 27.14 },
        { fabric: 'POLY', yards: 10.00, stitches: 45000, rate_stitch: 0.90, amount: 25.00 }
      ]
    };
    
    const response = await request(app)
      .post('/api/bills')
      .send(billData)
      .expect(201);
    
    expect(response.body.data).toHaveProperty('bill_id');
    expect(response.body.data.total_amount).toBe(52.14);
    
    // Verify DB
    const bill = await db('bill').where('bill_id', response.body.data.bill_id).first();
    expect(bill.party_name).toBe('Test Party');
    
    const items = await db('bill_item').where('bill_id', response.body.data.bill_id);
    expect(items).toHaveLength(2);
    expect(items[0].fabric).toBe('ORG');
    expect(items[1].fabric).toBe('POLY');
  });
});
```

#### 7.2.2 Bill Update Test

```typescript
describe('PUT /api/bills/:id', () => {
  it('should update existing bill', async () => {
    // Create bill first
    const created = await createTestBill();
    
    // Update
    const updateData = {
      header: { ...created.header, party_name: 'Updated Party' },
      items: created.items
    };
    
    await request(app)
      .put(`/api/bills/${created.bill_id}`)
      .send(updateData)
      .expect(200);
    
    // Verify
    const bill = await db('bill').where('bill_id', created.bill_id).first();
    expect(bill.party_name).toBe('Updated Party');
  });
});
```

### 7.3 End-to-End Tests

#### 7.3.1 Complete Workflow Test

```typescript
describe('Billing Workflow E2E', () => {
  it('should complete full billing workflow', async () => {
    // 1. Create bill with 2 designs × 3 variants each
    const billData = createComplexBillData();
    const createResponse = await request(app)
      .post('/api/bills')
      .send(billData)
      .expect(201);
    
    const billId = createResponse.body.data.bill_id;
    
    // 2. Load bill
    const loadResponse = await request(app)
      .get(`/api/bills/${billId}`)
      .expect(200);
    
    expect(loadResponse.body.data.items).toHaveLength(6);
    
    // 3. Export PDF
    const pdfResponse = await request(app)
      .get(`/api/bills/${billId}/export/pdf`)
      .expect(200);
    
    expect(pdfResponse.headers['content-type']).toBe('application/pdf');
    
    // 4. Export Excel
    const excelResponse = await request(app)
      .get(`/api/bills/${billId}/export/excel`)
      .expect(200);
    
    expect(excelResponse.headers['content-type']).toContain('spreadsheet');
    
    // 5. Verify totals
    const bill = await db('bill').where('bill_id', billId).first();
    const items = await db('bill_item').where('bill_id', billId);
    const calculatedTotal = items.reduce((sum, item) => sum + parseFloat(item.amount), 0);
    
    expect(parseFloat(bill.total_amount)).toBeCloseTo(calculatedTotal, 2);
  });
});
```

### 7.4 Manual QA Checklist

#### UI/UX Testing
- [ ] Factory header displays correctly with logo and company name
- [ ] Bill header fields are editable and validate properly
- [ ] Add Design button creates new design group
- [ ] Add Variant button opens modal with correct fields
- [ ] Matrix displays all variants in columns
- [ ] Metric rows display correct labels
- [ ] Input fields accept numeric values
- [ ] Calculated fields show lock icon and are read-only
- [ ] Tooltip shows formula on hover
- [ ] Total Bill updates when amounts change
- [ ] Save button validates and saves correctly
- [ ] Success notification appears after save
- [ ] Bill History table displays saved bills
- [ ] View button shows read-only bill
- [ ] Edit button loads bill into editor
- [ ] Print button opens print preview
- [ ] Export PDF downloads correct file
- [ ] Export Excel downloads correct file

#### Formula Testing
- [ ] Rate per yard calculates correctly
- [ ] Amount calculates from yards × rate per yard
- [ ] Total bill sums all variant amounts
- [ ] Changing stitches updates dependent fields
- [ ] Changing rate updates dependent fields
- [ ] Override confirmation works
- [ ] Reset to auto works after override

#### Data Persistence
- [ ] Bill saves with correct header data
- [ ] All variants save as separate bill_item rows
- [ ] Formula details JSON stores correctly
- [ ] Edit loads all data correctly
- [ ] Update modifies existing bill
- [ ] Delete removes bill and items (if implemented)

#### Export Testing
- [ ] PDF matches matrix layout
- [ ] PDF includes all variants
- [ ] PDF shows correct totals
- [ ] PDF has factory header and footer
- [ ] Excel has correct column structure
- [ ] Excel data matches UI
- [ ] Excel formulas work (if included)

#### Edge Cases
- [ ] Bill with 1 variant works
- [ ] Bill with 10+ variants works
- [ ] Bill with multiple designs works
- [ ] Empty fabric name handled
- [ ] Zero yards handled
- [ ] Negative values rejected
- [ ] Very large numbers handled
- [ ] Decimal precision maintained
- [ ] Special characters in party name handled
