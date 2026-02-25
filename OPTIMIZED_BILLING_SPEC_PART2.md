# Optimized Billing - Part 2: Formulas & Calculations

## 3. Formulas & Calculation Logic

### 3.1 Core Formulas

#### Formula 1: Fabric Yards (Auto-calculated)
```
fabric_yards = (machine_gazana / d_stitch) * stitches_done
```
- **When**: When machine_gazana and d_stitch are available
- **Display**: "Auto: Gazana ÷ D-Stitch × Stitches"

#### Formula 2: Rate per Yard/Meter
```
rate_per_yds = (d_stitch / 1000) * 2.77 * rate_stitch
```
- **Display**: "Formula: (D-Stitch ÷ 1000) × 2.77 × Rate"

#### Formula 3: Rate per Repeat
```
rate_repeat = rate_stitch * stitches_per_repeat
```
- **Display**: "Formula: Rate/Stitch × Stitches/Repeat"

#### Formula 4: Amount Calculation (Primary)
```
amount = fabric_yards * rate_per_yds
```
- **Display**: "Formula: Yards × Rate/Yard"

#### Formula 5: Amount Calculation (HDS Fallback)
```
amount = (stitches / 1000) * rate_stitch * 100
```
- **When**: When fabric yards not available
- **Display**: "HDS: (Stitches ÷ 1000) × Rate × 100"

### 3.2 Calculation Flow

```
User Input Changes
       ↓
Update Dependent Fields
       ↓
Recalculate Amount
       ↓
Update Total Bill
       ↓
Store formula_details JSON
```

### 3.3 Live Calculation Rules

1. **On stitches change**: Recalculate fabric_yards (if auto), rate_per_yds, amount
2. **On rate_stitch change**: Recalculate rate_per_yds, rate_repeat, amount
3. **On yards change**: Recalculate amount
4. **On repeats change**: Recalculate rate_repeat
5. **On any change**: Update Total Bill at bottom

### 3.4 User Override Handling

When user manually edits a calculated field:
1. Show confirmation dialog: "Override auto-calculated value?"
2. If confirmed:
   - Mark field as overridden in formula_details
   - Use user value instead of calculated
   - Show small "override" indicator icon
3. Provide "Reset to Auto" button to revert

### 3.5 Validation Rules

- `stitches` > 0
- `rate_stitch` > 0
- `yards` >= 0
- `repeats` >= 0
- `pieces` >= 0
- `amount` >= 0
- At least one variant per design
- Party name required
- Bill date required
