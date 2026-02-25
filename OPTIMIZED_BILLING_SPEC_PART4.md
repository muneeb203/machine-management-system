# Optimized Billing - Part 4: Backend API Specification

## 5. Backend API Endpoints

### 5.1 Create Bill
**Endpoint**: `POST /api/bills`

**Request Body**:
```json
{
  "header": {
    "party_name": "ABC Textiles Ltd",
    "bill_date": "2026-02-06",
    "collection": "Summer 2024",
    "design_no": "FLORAL-001",
    "notes": "Rush order",
    "igp": "IGP-2024-001",
    "code": "WTE-001"
  },
  "items": [
    {
      "design_no": "FLORAL-001",
      "collection": "Summer 2024",
      "fabric": "ORG",
      "yards": 11.55,
      "stitches": 50000,
      "rate_stitch": 0.85,
      "rate_per_yds": 2.35,
      "rate_repeat": 42.50,
      "repeats": 100,
      "pieces": 50,
      "amount": 27.14,
      "wte_ogp": "WTE001",
      "h2h_po": "H2H001",
      "formula_details": {
        "method": "HDS",
        "inputs": {...},
        "calculated": {...}
      }
    },
    {
      "design_no": "FLORAL-001",
      "collection": "Summer 2024",
      "fabric": "POLY",
      "yards": 10.00,
      "stitches": 45000,
      "rate_stitch": 0.90,
      "rate_per_yds": 2.50,
      "rate_repeat": 45.00,
      "repeats": 95,
      "pieces": 48,
      "amount": 25.00,
      "wte_ogp": "WTE002",
      "h2h_po": "H2H002",
      "formula_details": {...}
    }
  ]
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "bill_id": 123,
    "bill_number": "BILL-2026-0123",
    "total_amount": 52.14,
    "items_count": 2
  },
  "message": "Bill created successfully"
}
```

**Validation**:
- Party name required (min 2 chars)
- Bill date required and valid
- At least one item required
- Each item must have: fabric, stitches > 0, rate_stitch > 0
- Total amount must match sum of item amounts

**Server-side Logic**:
```typescript
async function createBill(req, res) {
  const { header, items } = req.body;
  
  // Validate
  if (!header.party_name || !header.bill_date) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'At least one item required' });
  }
  
  // Generate bill number
  const billNumber = await generateBillNumber();
  
  // Calculate total
  const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);
  
  // Start transaction
  const trx = await db.transaction();
  
  try {
    // Insert bill header
    const [billId] = await trx('bill').insert({
      bill_number: billNumber,
      bill_date: header.bill_date,
      party_name: header.party_name,
      po_number: header.collection,
      total_amount: totalAmount,
      notes: header.notes,
      created_by: req.user.id,
      created_at: new Date()
    });
    
    // Insert bill items
    const itemsToInsert = items.map(item => ({
      bill_id: billId,
      design_no: item.design_no,
      collection: item.collection,
      fabric: item.fabric,
      yards: item.yards,
      stitches: item.stitches,
      rate_stitch: item.rate_stitch,
      rate_per_yds: item.rate_per_yds,
      rate_repeat: item.rate_repeat,
      repeats: item.repeats,
      pieces: item.pieces,
      amount: item.amount,
      wte_ogp: item.wte_ogp,
      h2h_po: item.h2h_po,
      formula_details: JSON.stringify(item.formula_details)
    }));
    
    await trx('bill_item').insert(itemsToInsert);
    
    await trx.commit();
    
    res.status(201).json({
      success: true,
      data: { bill_id: billId, bill_number: billNumber, total_amount: totalAmount },
      message: 'Bill created successfully'
    });
  } catch (error) {
    await trx.rollback();
    res.status(500).json({ error: error.message });
  }
}
```


### 5.2 Update Bill
**Endpoint**: `PUT /api/bills/:id`

**Request Body**: Same as Create Bill

**Response**: Same as Create Bill

**Logic**: Delete existing bill_items and recreate (simpler than update logic)

### 5.3 Get Bill by ID
**Endpoint**: `GET /api/bills/:id`

**Response**:
```json
{
  "success": true,
  "data": {
    "bill": {
      "bill_id": 123,
      "bill_number": "BILL-2026-0123",
      "bill_date": "2026-02-06",
      "party_name": "ABC Textiles Ltd",
      "po_number": "Summer 2024",
      "total_amount": 52.14,
      "notes": "Rush order",
      "created_at": "2026-02-06T10:30:00Z"
    },
    "items": [
      {
        "bill_item_id": 456,
        "design_no": "FLORAL-001",
        "fabric": "ORG",
        "yards": 11.55,
        "stitches": 50000,
        "rate_stitch": 0.85,
        "amount": 27.14,
        ...
      }
    ]
  }
}
```

### 5.4 List Bills (History)
**Endpoint**: `GET /api/bills`

**Query Parameters**:
- `page` (default: 1)
- `limit` (default: 20)
- `search` (party name or bill number)
- `from_date`, `to_date`

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "bill_id": 123,
      "bill_number": "BILL-2026-0123",
      "bill_date": "2026-02-06",
      "party_name": "ABC Textiles Ltd",
      "items_count": 2,
      "total_amount": 52.14
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

### 5.5 Get Bill for Print
**Endpoint**: `GET /api/bills/:id/print`

**Response**: HTML template ready for PDF conversion

**Template Structure**:
```html
<!DOCTYPE html>
<html>
<head>
  <style>
    @page { size: A4 landscape; margin: 1cm; }
    body { font-family: Arial; font-size: 10pt; }
    .header { text-align: center; margin-bottom: 20px; }
    .matrix { width: 100%; border-collapse: collapse; }
    .matrix th, .matrix td { border: 1px solid #000; padding: 5px; }
    .total { font-weight: bold; background: #f0f0f0; }
  </style>
</head>
<body>
  <div class="header">
    <h2>WEAVETEX EMBROIDERY</h2>
    <p>IGP: {{igp}} | Code: {{code}}</p>
  </div>
  
  <table class="info">
    <tr>
      <td>Party: {{party_name}}</td>
      <td>Bill #: {{bill_number}}</td>
      <td>Date: {{bill_date}}</td>
    </tr>
  </table>
  
  <table class="matrix">
    <thead>
      <tr>
        <th>Metric</th>
        {{#each variants}}
        <th>{{fabric}}<br/>{{yards}} YRD</th>
        {{/each}}
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>STITCH</td>
        {{#each variants}}
        <td>{{stitches}}</td>
        {{/each}}
      </tr>
      <!-- More rows -->
    </tbody>
    <tfoot>
      <tr class="total">
        <td colspan="{{colspan}}">TOTAL BILL</td>
        <td>${{total_amount}}</td>
      </tr>
    </tfoot>
  </table>
</body>
</html>
```

### 5.6 Export to PDF
**Endpoint**: `GET /api/bills/:id/export/pdf`

**Response**: PDF file download

**Implementation** (using Puppeteer):
```typescript
async function exportPDF(req, res) {
  const { id } = req.params;
  
  // Get bill data
  const bill = await getBillWithItems(id);
  
  // Render HTML template
  const html = renderPrintTemplate(bill);
  
  // Generate PDF
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setContent(html);
  const pdf = await page.pdf({
    format: 'A4',
    landscape: true,
    printBackground: true
  });
  await browser.close();
  
  // Send PDF
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=bill-${bill.bill_number}.pdf`);
  res.send(pdf);
}
```

### 5.7 Export to Excel
**Endpoint**: `GET /api/bills/:id/export/excel`

**Response**: Excel file download

**Implementation** (using exceljs):
```typescript
async function exportExcel(req, res) {
  const { id } = req.params;
  const bill = await getBillWithItems(id);
  
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Bill');
  
  // Add header
  worksheet.addRow(['WEAVETEX EMBROIDERY']);
  worksheet.addRow([`Party: ${bill.party_name}`, `Bill #: ${bill.bill_number}`, `Date: ${bill.bill_date}`]);
  worksheet.addRow([]);
  
  // Add matrix headers
  const headers = ['Metric'];
  bill.items.forEach(item => {
    headers.push(`${item.fabric} (${item.yards} YRD)`);
  });
  worksheet.addRow(headers);
  
  // Add metric rows
  const metrics = ['STITCH', 'RATE/STITCH', 'RATE/YD', 'RATE/REPEAT', 'REPEATS', 'PIECES', 'AMOUNT', 'WTE OGP', 'H2H PO'];
  metrics.forEach(metric => {
    const row = [metric];
    bill.items.forEach(item => {
      row.push(item[metricFieldMap[metric]]);
    });
    worksheet.addRow(row);
  });
  
  // Add total
  worksheet.addRow(['TOTAL BILL', '', '', bill.total_amount]);
  
  // Send file
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=bill-${bill.bill_number}.xlsx`);
  await workbook.xlsx.write(res);
}
```
