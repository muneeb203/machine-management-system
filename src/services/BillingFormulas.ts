/**
 * Billing formula calculations
 */

export interface FormulaInputs {
  machine_gazana?: number;
  d_stitch?: number;
  stitches_done?: number;
  stitches?: number;
  rate_stitch?: number;
  yards?: number;
  repeats?: number;
  stitches_per_repeat?: number;
}

export interface FormulaResults {
  fabric_yards?: number;
  rate_per_yds?: number;
  rate_repeat?: number;
  amount?: number;
}

export interface FormulaDetails {
  method: string;
  inputs: FormulaInputs;
  calculated: FormulaResults;
  timestamp: string;
  user_overrides?: Record<string, boolean>;
}

/**
 * Calculate fabric yards from machine data
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
 * Calculate rate per yard/meter
 * Formula: rate_per_yds = (d_stitch / 1000) * 2.77 * rate_stitch
 */
export function calculateRatePerYard(
  d_stitch: number,
  rate_stitch: number
): number {
  return (d_stitch / 1000) * 2.77 * rate_stitch;
}

/**
 * Calculate rate per repeat
 * Formula: rate_repeat = rate_stitch * stitches_per_repeat
 */
export function calculateRatePerRepeat(
  rate_stitch: number,
  stitches_per_repeat: number
): number {
  return rate_stitch * stitches_per_repeat;
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
  item: Partial<FormulaInputs>,
  d_stitch: number = 104
): FormulaResults & { formula_details: FormulaDetails } {
  const results: FormulaResults = {};
  
  // Calculate rate per yard if we have rate_stitch
  if (item.rate_stitch !== undefined) {
    results.rate_per_yds = calculateRatePerYard(d_stitch, item.rate_stitch);
  }
  
  // Calculate rate per repeat if we have stitches per repeat
  if (item.rate_stitch !== undefined && item.stitches_per_repeat !== undefined) {
    results.rate_repeat = calculateRatePerRepeat(item.rate_stitch, item.stitches_per_repeat);
  }
  
  // Calculate fabric yards if we have machine data
  if (item.machine_gazana && item.d_stitch && item.stitches_done) {
    results.fabric_yards = calculateFabricYards(
      item.machine_gazana,
      item.d_stitch,
      item.stitches_done
    );
  }
  
  // Calculate amount (primary method: yards * rate_per_yds)
  if (item.yards !== undefined && results.rate_per_yds !== undefined) {
    results.amount = calculateAmount(item.yards, results.rate_per_yds);
  }
  // Fallback: HDS method
  else if (item.stitches !== undefined && item.rate_stitch !== undefined) {
    results.amount = calculateAmountHDS(item.stitches, item.rate_stitch);
  }
  
  // Create formula details for audit
  const formula_details: FormulaDetails = {
    method: item.yards ? 'STANDARD' : 'HDS',
    inputs: {
      d_stitch,
      stitches: item.stitches,
      rate_stitch: item.rate_stitch,
      yards: item.yards,
      machine_gazana: item.machine_gazana,
      stitches_done: item.stitches_done,
      repeats: item.repeats,
      stitches_per_repeat: item.stitches_per_repeat
    },
    calculated: results,
    timestamp: new Date().toISOString()
  };
  
  return {
    ...results,
    formula_details
  };
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
