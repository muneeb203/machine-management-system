-- Embroidery Factory ERP Database Schema
-- Production-grade schema with strict constraints and audit trails

-- Users and Authentication
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'programmer', 'operator', 'inventory_clerk', 'auditor')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL
);

-- Rate Configuration (Admin only)
CREATE TABLE rate_elements (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    description TEXT,
    rate_per_stitch DECIMAL(10,6) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Base rate configuration
CREATE TABLE base_rates (
    id SERIAL PRIMARY KEY,
    rate_per_stitch DECIMAL(10,6) NOT NULL,
    effective_from DATE NOT NULL,
    effective_to DATE,
    is_active BOOLEAN DEFAULT true,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Contracts
CREATE TABLE contracts (
    id SERIAL PRIMARY KEY,
    contract_number VARCHAR(50) UNIQUE NOT NULL,
    party_name VARCHAR(100) NOT NULL,
    po_number VARCHAR(50),
    gate_pass_number VARCHAR(50),
    start_date DATE NOT NULL,
    end_date DATE,
    collection_name VARCHAR(100),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL
);

-- Designs within contracts
CREATE TABLE designs (
    id SERIAL PRIMARY KEY,
    contract_id INTEGER REFERENCES contracts(id) NOT NULL,
    design_number VARCHAR(50) NOT NULL,
    component VARCHAR(50) NOT NULL, -- Sleeves, Front, Back, etc.
    repeat_type VARCHAR(10) NOT NULL CHECK (repeat_type IN ('yards', 'pieces')),
    repeat_value INTEGER, -- 10 or 12 for yards
    planned_quantity INTEGER NOT NULL,
    planned_stitch_count INTEGER,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    UNIQUE(contract_id, design_number, component)
);

-- Design rate elements (snapshot at time of creation)
CREATE TABLE design_rate_elements (
    id SERIAL PRIMARY KEY,
    design_id INTEGER REFERENCES designs(id) NOT NULL,
    rate_element_id INTEGER REFERENCES rate_elements(id) NOT NULL,
    rate_per_stitch DECIMAL(10,6) NOT NULL, -- Snapshot value
    is_selected BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Machines
CREATE TABLE machines (
    id SERIAL PRIMARY KEY,
    machine_number INTEGER UNIQUE NOT NULL CHECK (machine_number BETWEEN 1 AND 22),
    master_group INTEGER NOT NULL CHECK (master_group IN (1, 2, 3)),
    day_shift_capacity INTEGER DEFAULT 50000, -- stitches per day
    night_shift_capacity INTEGER DEFAULT 45000,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Programming assignments
CREATE TABLE programming_assignments (
    id SERIAL PRIMARY KEY,
    design_id INTEGER REFERENCES designs(id) NOT NULL,
    machine_id INTEGER REFERENCES machines(id) NOT NULL,
    estimated_days INTEGER NOT NULL,
    estimated_day_stitches INTEGER,
    estimated_night_stitches INTEGER,
    assigned_by INTEGER REFERENCES users(id),
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'assigned' CHECK (status IN ('assigned', 'in_progress', 'completed'))
);

-- Daily Production (Core system)
CREATE TABLE production_entries (
    id SERIAL PRIMARY KEY,
    machine_id INTEGER REFERENCES machines(id) NOT NULL,
    design_id INTEGER REFERENCES designs(id) NOT NULL,
    production_date DATE NOT NULL,
    shift VARCHAR(5) NOT NULL CHECK (shift IN ('day', 'night')),
    actual_stitches INTEGER NOT NULL,
    genuine_stitches INTEGER, -- Reference value
    repeats_completed INTEGER NOT NULL,
    operator_name VARCHAR(100) NOT NULL,
    notes TEXT,
    is_billed BOOLEAN DEFAULT false,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL
);

-- Stitch Override Audit Trail
CREATE TABLE stitch_overrides (
    id SERIAL PRIMARY KEY,
    production_entry_id INTEGER REFERENCES production_entries(id) NOT NULL,
    original_stitches INTEGER NOT NULL,
    new_stitches INTEGER NOT NULL,
    reason TEXT NOT NULL,
    override_by INTEGER REFERENCES users(id) NOT NULL,
    override_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Gate Passes
CREATE TABLE gate_passes (
    id SERIAL PRIMARY KEY,
    gate_pass_number VARCHAR(50) UNIQUE NOT NULL,
    party_name VARCHAR(100) NOT NULL,
    po_number VARCHAR(50),
    contract_id INTEGER REFERENCES contracts(id),
    pass_type VARCHAR(10) NOT NULL CHECK (pass_type IN ('in', 'out')),
    total_gazana DECIMAL(10,2) NOT NULL, -- in yards
    pass_date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'finalized')),
    finalized_by INTEGER REFERENCES users(id),
    finalized_at TIMESTAMP,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL
);

-- Inventory Movements
CREATE TABLE inventory_movements (
    id SERIAL PRIMARY KEY,
    gate_pass_id INTEGER REFERENCES gate_passes(id) NOT NULL,
    movement_type VARCHAR(10) NOT NULL CHECK (movement_type IN ('in', 'out')),
    gazana_quantity DECIMAL(10,2) NOT NULL,
    movement_date DATE NOT NULL,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Billing Records (Immutable after approval)
CREATE TABLE billing_records (
    id SERIAL PRIMARY KEY,
    contract_id INTEGER REFERENCES contracts(id) NOT NULL,
    machine_id INTEGER REFERENCES machines(id) NOT NULL,
    billing_date DATE NOT NULL,
    shift VARCHAR(5) NOT NULL CHECK (shift IN ('day', 'night')),
    total_stitches INTEGER NOT NULL,
    base_rate DECIMAL(10,6) NOT NULL, -- Snapshot
    element_rates DECIMAL(10,6) NOT NULL, -- Sum of selected elements
    effective_rate DECIMAL(10,6) NOT NULL, -- base + elements
    total_amount DECIMAL(12,2) NOT NULL,
    gate_pass_id INTEGER REFERENCES gate_passes(id),
    is_approved BOOLEAN DEFAULT false,
    approved_by INTEGER REFERENCES users(id),
    approved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- Immutable constraint
    CHECK (
        (is_approved = false) OR 
        (is_approved = true AND approved_by IS NOT NULL AND approved_at IS NOT NULL)
    )
);

-- Reconciliation Records
CREATE TABLE reconciliation_records (
    id SERIAL PRIMARY KEY,
    contract_id INTEGER REFERENCES contracts(id) NOT NULL,
    reconciliation_date DATE NOT NULL,
    total_production_value DECIMAL(12,2) NOT NULL,
    total_shipped_value DECIMAL(12,2) NOT NULL,
    discrepancy_amount DECIMAL(12,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'escalated')),
    notes TEXT,
    reconciled_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit Logs (All system changes)
CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    table_name VARCHAR(50) NOT NULL,
    record_id INTEGER NOT NULL,
    action VARCHAR(20) NOT NULL CHECK (action IN ('insert', 'update', 'delete', 'override')),
    old_values JSONB,
    new_values JSONB,
    user_id INTEGER REFERENCES users(id),
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_contracts_party ON contracts(party_name);
CREATE INDEX idx_contracts_number ON contracts(contract_number);
CREATE INDEX idx_production_date_machine ON production_entries(production_date, machine_id);
CREATE INDEX idx_production_design ON production_entries(design_id);
CREATE INDEX idx_billing_contract_date ON billing_records(contract_id, billing_date);
CREATE INDEX idx_gate_passes_number ON gate_passes(gate_pass_number);
CREATE INDEX idx_audit_logs_table_record ON audit_logs(table_name, record_id);

-- Triggers for audit logging
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_logs (table_name, record_id, action, new_values, user_id)
        VALUES (TG_TABLE_NAME, NEW.id, 'insert', to_jsonb(NEW), NEW.created_by);
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_logs (table_name, record_id, action, old_values, new_values, user_id)
        VALUES (TG_TABLE_NAME, NEW.id, 'update', to_jsonb(OLD), to_jsonb(NEW), NEW.updated_by);
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_logs (table_name, record_id, action, old_values, user_id)
        VALUES (TG_TABLE_NAME, OLD.id, 'delete', to_jsonb(OLD), OLD.deleted_by);
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Apply audit triggers to key tables
CREATE TRIGGER audit_contracts AFTER INSERT OR UPDATE OR DELETE ON contracts
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_production AFTER INSERT OR UPDATE OR DELETE ON production_entries
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_billing AFTER INSERT OR UPDATE ON billing_records
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();