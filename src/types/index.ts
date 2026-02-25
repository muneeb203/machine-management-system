// Core TypeScript interfaces for the ERP system

export interface User {
  id: number;
  username: string;
  email: string;
  role: 'admin' | 'programmer' | 'operator' | 'inventory_clerk' | 'auditor';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface RateElement {
  id: number;
  name: string;
  description?: string;
  ratePerStitch: number;
  isActive: boolean;
  createdBy: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface BaseRate {
  id: number;
  ratePerStitch: number;
  effectiveFrom: Date;
  effectiveTo?: Date;
  isActive: boolean;
  createdBy: number;
  createdAt: Date;
}

export interface Contract {
  id: number;
  contractNumber: string;
  partyName: string;
  poNumber?: string;
  gatePassNumber?: string;
  startDate: Date;
  endDate?: Date;
  collectionName?: string;
  status: 'active' | 'completed' | 'cancelled';
  createdBy: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface Design {
  id: number;
  contractId: number;
  designNumber: string;
  component: string; // Sleeves, Front, Back, etc.
  repeatType: 'yards' | 'pieces';
  repeatValue?: number; // 10 or 12 for yards
  plannedQuantity: number;
  plannedStitchCount?: number;
  status: 'pending' | 'in_progress' | 'completed';
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
  // Related data
  contract?: Contract;
  rateElements?: DesignRateElement[];
}

export interface DesignRateElement {
  id: number;
  designId: number;
  rateElementId: number;
  ratePerStitch: number; // Snapshot value
  isSelected: boolean;
  createdAt: Date;
  // Related data
  rateElement?: RateElement;
}

export interface Machine {
  id: number;
  machineNumber: number; // 1-22
  masterGroup: 1 | 2 | 3;
  dayShiftCapacity: number;
  nightShiftCapacity: number;
  isActive: boolean;
  createdAt: Date;
}

export interface ProgrammingAssignment {
  id: number;
  designId: number;
  machineId: number;
  estimatedDays: number;
  estimatedDayStitches?: number;
  estimatedNightStitches?: number;
  assignedBy: number;
  assignedAt: Date;
  status: 'assigned' | 'in_progress' | 'completed';
  // Related data
  design?: Design;
  machine?: Machine;
}

export interface ProductionEntry {
  id: number;
  machineId: number;
  designId: number;
  productionDate: Date;
  shift: 'day' | 'night';
  actualStitches: number;
  genuineStitches?: number; // Reference value
  repeatsCompleted: number;
  operatorName: string;
  notes?: string;
  isBilled: boolean;
  createdBy: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
  // Related data
  machine?: Machine;
  design?: Design;
  overrides?: StitchOverride[];
}

export interface StitchOverride {
  id: number;
  productionEntryId: number;
  originalStitches: number;
  newStitches: number;
  reason: string;
  overrideBy: number;
  overrideAt: Date;
  // Related data
  user?: User;
}

export interface GatePass {
  id: number;
  gatePassNumber: string;
  partyName: string;
  poNumber?: string;
  contractId?: number;
  passType: 'in' | 'out';
  totalGazana: number; // in yards
  passDate: Date;
  status: 'pending' | 'approved' | 'finalized';
  finalizedBy?: number;
  finalizedAt?: Date;
  createdBy: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
  // Related data
  contract?: Contract;
  movements?: InventoryMovement[];
}

export interface InventoryMovement {
  id: number;
  gatePassId: number;
  movementType: 'in' | 'out';
  gazanaQuantity: number;
  movementDate: Date;
  createdBy: number;
  createdAt: Date;
}

export interface BillingRecord {
  id: number;
  contractId: number;
  machineId: number;
  billingDate: Date;
  shift: 'day' | 'night';
  totalStitches: number;
  baseRate: number; // Snapshot
  elementRates: number; // Sum of selected elements
  effectiveRate: number; // base + elements
  totalAmount: number;
  gatePassId?: number;
  isApproved: boolean;
  approvedBy?: number;
  approvedAt?: Date;
  createdAt: Date;
  // Related data
  contract?: Contract;
  machine?: Machine;
  gatePass?: GatePass;
}

export interface ReconciliationRecord {
  id: number;
  contractId: number;
  reconciliationDate: Date;
  totalProductionValue: number;
  totalShippedValue: number;
  discrepancyAmount: number;
  status: 'pending' | 'resolved' | 'escalated';
  notes?: string;
  reconciledBy?: number;
  createdAt: Date;
  updatedAt: Date;
  // Related data
  contract?: Contract;
}

export interface AuditLog {
  id: number;
  tableName: string;
  recordId: number;
  action: 'insert' | 'update' | 'delete' | 'override';
  oldValues?: any;
  newValues?: any;
  userId?: number;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
  // Related data
  user?: User;
}

// API Request/Response types
export interface CreateContractRequest {
  contractNumber: string;
  partyName: string;
  poNumber?: string;
  gatePassNumber?: string;
  contractDate: string; // Changed from startDate
  contractEndDate?: string; // Changed from endDate
  contractDuration?: number;
  collectionName?: string;
  items?: any[]; // Allow items array
  machineIds?: number[]; // Added for Machine Assignment
}

export interface CreateDesignRequest {
  contractId: number;
  designNumber: string;
  component: string;
  repeatType: 'yards' | 'pieces';
  repeatValue?: number;
  plannedQuantity: number;
  plannedStitchCount?: number;
  rateElements: {
    rateElementId: number;
    isSelected: boolean;
  }[];
}

export interface ProductionEntryRequest {
  machineId: number;
  contractItemId?: number; // New field
  designId?: number; // Deprecated but kept for backward compat if needed
  productionDate: string;
  shift: 'day' | 'night';
  actualStitches: number;
  genuineStitches?: number;
  repeatsCompleted: number;
  operatorName: string;
  notes?: string;
}

export interface StitchOverrideRequest {
  productionEntryId: number;
  newStitches: number;
  reason: string;
}

export interface BulkProductionEntry {
  entries: ProductionEntryRequest[];
}

// Dashboard and reporting types
export interface DashboardStats {
  totalMachines: number;
  activeMachines: number;
  todayProduction: number;
  pendingBilling: number;
  activeContracts: number;
}

export interface MachineProductionSummary {
  machineId: number;
  machineNumber: number;
  masterGroup: number;
  dayShiftStitches: number;
  nightShiftStitches: number;
  totalStitches: number;
  dayShiftAmount: number;
  nightShiftAmount: number;
  totalAmount: number;
}

export interface ContractProfitability {
  contractId: number;
  contractNumber: string;
  partyName: string;
  totalProduction: number;
  totalBilling: number;
  profitMargin: number;
}

// Error types
export interface ApiError {
  message: string;
  code: string;
  details?: any;
}

export interface ValidationError {
  field: string;
  message: string;
}

// Pagination
export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}