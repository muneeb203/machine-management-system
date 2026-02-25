import { BillItem, FormulaDetails } from '../types/billing';

const D_STITCH_DEFAULT = 104;

/**
 * Calculate fabric yards from machine data (same as Contract Management)
 * Formula: fabric_yards = (machine_gazana / d_stitch) * stitches_done
 */
export function calculateFabricYards(
  machine_gazana: number,
  d_stitch: number,
  stitches_done: number
): number {
  if (d_stitch === 0) return 0;
  return (machine_gazana / d_stitch) * stitches_done;
}

/**
 * Calculate rate per yard/meter (same as Contract Section 4)
 * Formula: rate_per_yds = (d_stitch / 1000) * 2.77 * rate_stitch
 */
export function calculateRatePerYard(
  d_stitch: number,
  rate_stitch: number
): number {
  return (d_stitch / 1000) * 2.77 * rate_stitch;
}

/**
 * Calculate amount from yards and rate
 * Formula: amount = yards * rate_per_yds
 */
export function calculateAmount(
  yards: number,
  rate_per_yds: number
): number {
  return yards * rate_per_yds;
}

/**
 * Calculate amount using HDS method (fallback)
 * Formula: amount = (stitches / 1000) * rate_stitch * 100
 */
export function calculateAmountHDS(
  stitches: number,
  rate_stitch: number
): number {
  return (stitches / 1000) * rate_stitch * 100;
}

/**
 * Recalculate all dependent fields for a bill item
 */
export function recalculateBillItem(
  item: Partial<BillItem>,
  d_stitch: number = D_STITCH_DEFAULT
): Partial<BillItem> {
  const updated: Partial<BillItem> = { ...item };
  
  // Calculate rate per yard if we have rate_stitch
  if (item.rate_stitch !== undefined && item.rate_stitch > 0) {
    updated.rate_per_yds = roundTo2Decimals(
      calculateRatePerYard(d_stitch, item.rate_stitch)
    );
  }
  
  // Calculate amount (primary method: yards * rate_per_yds)
  if (item.yards !== undefined && updated.rate_per_yds !== undefined) {
    updated.amount = roundTo2Decimals(
      calculateAmount(item.yards, updated.rate_per_yds)
    );
  }
  // Fallback: HDS method
  else if (item.stitches !== undefined && item.rate_stitch !== undefined) {
    updated.amount = roundTo2Decimals(
      calculateAmountHDS(item.stitches, item.rate_stitch)
    );
  }
  
  // Create formula details for audit
  updated.formula_details = {
    method: item.yards ? 'STANDARD' : 'HDS',
    inputs: {
      d_stitch,
      stitches: item.stitches,
      rate_stitch: item.rate_stitch,
      yards: item.yards,
      repeats: item.repeats
    },
    calculated: {
      rate_per_yds: updated.rate_per_yds,
      amount: updated.amount
    },
    timestamp: new Date().toISOString()
  };
  
  return updated;
}

/**
 * Round to 2 decimal places
 */
export function roundTo2Decimals(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Round to 4 decimal places (for rates)
 */
export function roundTo4Decimals(value: number): number {
  return Math.round(value * 10000) / 10000;
}

/**
 * Format currency (Rupees)
 */
export function formatCurrency(value: number): string {
  return `Rs ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
