export interface BillHeader {
  party_name: string;
  bill_date: string;
  collection: string;
  design_no: string;
  notes: string;
  igp?: string;
  code?: string;
}

export interface BillItem {
  id?: string; // Temporary ID for UI
  bill_item_id?: number; // DB ID
  design_no: string;
  collection: string;
  component?: string;
  item_description?: string;
  fabric: string;
  yards: number;
  stitches: number;
  rate_stitch: number;
  rate_per_yds: number;
  rate_repeat: number;
  rate_piece?: number;
  repeats: number;
  pieces: number;
  amount: number;
  wte_ogp: string;
  h2h_po: string;
  formula_details?: FormulaDetails;
}

export interface FormulaDetails {
  method: string;
  inputs: {
    d_stitch?: number;
    stitches?: number;
    rate_stitch?: number;
    yards?: number;
    machine_gazana?: number;
    stitches_done?: number;
    repeats?: number;
  };
  calculated: {
    fabric_yards?: number;
    rate_per_yds?: number;
    rate_repeat?: number;
    amount?: number;
  };
  timestamp: string;
  user_overrides?: Record<string, boolean>;
}

export interface DesignGroup {
  design_no: string;
  collection: string;
  variants: BillItem[];
}

export interface BillHistoryItem {
  bill_id: number;
  bill_number: string;
  bill_date: string;
  party_name: string;
  po_number: string;
  total_amount: number;
  items_count: number;
  created_at: string;
}
