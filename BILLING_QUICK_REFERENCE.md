# Optimized Billing - Quick Reference Card

## 🎯 One-Page Summary

### What We're Building
Matrix-style billing page with multi-variant fabric columns, automatic formulas, and PDF/Excel export.

---

## 📊 Data Model

**One variant = One bill_item row**

```
Design: FLORAL-001
├─ Variant 1: ORG (11.55 YRD) → bill_item row 1
├─ Variant 2: POLY (10.00 YRD) → bill_item row 2
└─ Variant 3: COTTON (12.00 YRD) → bill_item row 3
```

---

## 🧮 Key Formulas

```
rate_per_yds = (d_stitch / 1000) × 2.77 × rate_stitch
amount = yards × rate_per_yds
fabric_yards = (machine_gazana / d_stitch) × stitches_done
```

---

## 🗄️ New Database Columns

Add to `bill_item` table:
- `fabric` (varchar 50)
- `yards` (decimal 10,2)
- `rate_stitch` (decimal 10,4)
- `rate_per_yds` (decimal 10,2)
- `rate_repeat` (decimal 10,2)
- `repeats` (decimal 10,2)
- `pieces` (int)
- `wte_ogp` (varchar 100)
- `h2h_po` (varchar 100)
- `formula_details` (json)

---

## 🔌 API Endpoints

```
POST   /api/bills              Create bill
PUT    /api/bills/:id          Update bill
GET    /api/bills              List bills
GET    /api/bills/:id          Get single bill
GET    /api/bills/:id/print    Print template
GET    /api/bills/:id/export/pdf    Export PDF
GET    /api/bills/:id/export/excel  Export Excel
```

---

## 🎨 UI Components

```
OptimizedBilling
├─ FactoryHeader (logo, IGP, code)
├─ BillHeader (party, date, collection)
├─ DesignGroup (repeatable)
│  ├─ DesignHeader
│  └─ MatrixTable
│     ├─ VariantColumn (repeatable)
│     └─ MetricRow (9 rows)
├─ TotalBill
├─ ActionButtons (Save, Preview, Export)
└─ BillHistory (table with pagination)
```

---

## ✅ Implementation Checklist

### Week 1: Backend
- [ ] Create migration
- [ ] Implement POST /api/bills
- [ ] Implement PUT /api/bills/:id
- [ ] Implement GET endpoints
- [ ] Add PDF export
- [ ] Add Excel export

### Week 2: Frontend
- [ ] Create main component
- [ ] Create matrix table
- [ ] Add formula logic
- [ ] Connect to API
- [ ] Add dialogs

### Week 3: Polish
- [ ] Add bill history
- [ ] Write tests
- [ ] Fix bugs
- [ ] Deploy

---

## 🧪 Testing Priority

1. **Formula calculations** (critical)
2. **Data persistence** (critical)
3. **PDF export layout** (high)
4. **Excel export** (high)
5. **UI responsiveness** (medium)

---

## 🚨 Common Issues

| Issue | Solution |
|-------|----------|
| Formulas not calculating | Check formula_details JSON |
| PDF export fails | Verify Puppeteer setup |
| Total doesn't match | Check decimal precision |
| Variants not saving | Verify bill_item structure |

---

## 📏 Validation Rules

- Party name: required, min 2 chars
- Bill date: required, valid date
- Items: at least 1 required
- Stitches: > 0
- Rate: > 0
- Yards: >= 0

---

## 🎯 Success Metrics

- Matrix displays 10+ variants smoothly
- Save completes in < 3 seconds
- PDF generates in < 5 seconds
- All tests pass
- Zero critical bugs

---

## 📚 Full Documentation

See `OPTIMIZED_BILLING_MASTER_SPEC.md` for complete specification across 7 parts.

---

## 🆘 Need Help?

1. Check relevant spec part (1-7)
2. Review this quick reference
3. Check implementation checklist
4. Contact technical lead

---

**Start Here**: Read Part 1 (Database) → Part 4 (API) → Part 5 (Frontend)
