-- ==============================================================================
-- WAREHOUSE PARCEL DISPATCH & HUB TRANSIT TRACKER
-- DATABASE SCHEMA DEFINITION (PostgreSQL / Supabase)
-- ==============================================================================
-- This script creates the core 6 relational tables, integrity constraints,
-- foreign keys, and an immutability trigger for the audit log.
-- ==============================================================================

-- Enable UUID extension if not already available
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Clean up existing objects in reverse dependency order (idempotent setup)
DROP TRIGGER IF EXISTS trg_prevent_audit_log_modification ON audit_log;
DROP FUNCTION IF EXISTS prevent_audit_log_modification();
DROP TABLE IF EXISTS audit_log CASCADE;
DROP TABLE IF EXISTS manifest_items CASCADE;
DROP TABLE IF EXISTS manifests CASCADE;
DROP TABLE IF EXISTS parcels CASCADE;
DROP TABLE IF EXISTS vans CASCADE;
DROP TABLE IF EXISTS zones CASCADE;

-- ------------------------------------------------------------------------------
-- 1. ZONES
-- Hub operational dispatch zones configured with PIN code prefix routing rules.
-- ------------------------------------------------------------------------------
CREATE TABLE zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    -- pin_prefix_rules stores acceptable postal code prefixes (e.g. ARRAY['110', '111'])
    pin_prefix_rules TEXT[] NOT NULL
);

COMMENT ON TABLE zones IS 'Delivery zones serviced by the hub, defining routing rules by PIN code prefix';
COMMENT ON COLUMN zones.pin_prefix_rules IS 'Array of postal code prefixes that map parcels to this zone';

-- ------------------------------------------------------------------------------
-- 2. VANS
-- Fleet vehicles assigned to specific zones for parcel transit.
-- ------------------------------------------------------------------------------
CREATE TABLE vans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plate_no TEXT NOT NULL UNIQUE,
    zone_id UUID NOT NULL REFERENCES zones(id) ON DELETE RESTRICT,
    capacity_kg NUMERIC(10, 2) NOT NULL CHECK (capacity_kg > 0),
    current_load_kg NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (current_load_kg >= 0),
    status TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'LOADING', 'DISPATCHED'))
);

COMMENT ON TABLE vans IS 'Delivery fleet vehicles assigned to a single zone with capacity limitations';
COMMENT ON COLUMN vans.capacity_kg IS 'Maximum payload weight capacity in kilograms';
COMMENT ON COLUMN vans.current_load_kg IS 'Current total weight of LOADED parcels; dynamically recalculated from parcels';
COMMENT ON COLUMN vans.status IS 'Operational status of the van: AVAILABLE, LOADING, or DISPATCHED';

-- ------------------------------------------------------------------------------
-- 3. PARCELS
-- Individual items received at the hub awaiting dispatch to customer destinations.
-- ------------------------------------------------------------------------------
CREATE TABLE parcels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tracking_code TEXT NOT NULL UNIQUE,
    pin_code TEXT NOT NULL,
    weight_kg NUMERIC(10, 2) NOT NULL CHECK (weight_kg > 0),
    zone_id UUID NOT NULL REFERENCES zones(id) ON DELETE RESTRICT,
    status TEXT NOT NULL DEFAULT 'UNASSIGNED' CHECK (status IN ('UNASSIGNED', 'LOADED', 'IN_TRANSIT', 'DELIVERED')),
    van_id UUID REFERENCES vans(id) ON DELETE SET NULL,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE parcels IS 'Physical parcels tracked through the transit lifecycle';
COMMENT ON COLUMN parcels.tracking_code IS 'Unique alphanumeric barcode/tracking identifier';
COMMENT ON COLUMN parcels.weight_kg IS 'Weight in kilograms, enforced strictly greater than 0';
COMMENT ON COLUMN parcels.status IS 'Lifecycle state: UNASSIGNED, LOADED, IN_TRANSIT, or DELIVERED';
COMMENT ON COLUMN parcels.van_id IS 'Current van carrying this parcel (nullable if UNASSIGNED)';

-- ------------------------------------------------------------------------------
-- 4. MANIFESTS
-- Dispatch manifests grouping parcels assigned to a single vehicle run.
-- ------------------------------------------------------------------------------
CREATE TABLE manifests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    van_id UUID NOT NULL REFERENCES vans(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    dispatched_at TIMESTAMPTZ,
    dispatched_by UUID
);

COMMENT ON TABLE manifests IS 'Official dispatch shipping lists associated with a van trip';
COMMENT ON COLUMN manifests.dispatched_at IS 'Timestamp when the manifest and vehicle transitioned to transit';
COMMENT ON COLUMN manifests.dispatched_by IS 'Identifier of the supervisor or system user who triggered dispatch';

-- ------------------------------------------------------------------------------
-- 5. MANIFEST_ITEMS
-- Junction table linking manifests with the parcels included in that dispatch run.
-- ------------------------------------------------------------------------------
CREATE TABLE manifest_items (
    manifest_id UUID NOT NULL REFERENCES manifests(id) ON DELETE CASCADE,
    parcel_id UUID NOT NULL REFERENCES parcels(id) ON DELETE RESTRICT,
    PRIMARY KEY (manifest_id, parcel_id),
    -- Ensure a parcel is not assigned to multiple manifests simultaneously
    CONSTRAINT uq_manifest_items_parcel UNIQUE (parcel_id)
);

COMMENT ON TABLE manifest_items IS 'Line items linking manifests to their assigned parcels';

-- ------------------------------------------------------------------------------
-- 6. AUDIT_LOG
-- Append-only historical ledger tracking all hub movements and state changes.
-- ------------------------------------------------------------------------------
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID,
    action TEXT NOT NULL CHECK (action IN ('SCAN', 'LOAD', 'DISPATCH')),
    parcel_id UUID REFERENCES parcels(id) ON DELETE SET NULL,
    van_id UUID REFERENCES vans(id) ON DELETE SET NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

COMMENT ON TABLE audit_log IS 'Immutable tamper-proof audit trail for warehouse compliance';
COMMENT ON COLUMN audit_log.action IS 'High-level action type: SCAN, LOAD, or DISPATCH';
COMMENT ON COLUMN audit_log.metadata IS 'Structured JSON payload storing contextual metrics at log time';

-- ------------------------------------------------------------------------------
-- AUDIT LOG IMMUTABILITY ENFORCEMENT
-- Blocks any UPDATE or DELETE operations on audit_log at database engine level.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'audit_log is immutable: % operations are strictly prohibited.', TG_OP;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_audit_log_modification
BEFORE UPDATE OR DELETE ON audit_log
FOR EACH ROW
EXECUTE FUNCTION prevent_audit_log_modification();

-- ------------------------------------------------------------------------------
-- PERFORMANCE INDEXES
-- Optimize lookups during loading, dispatch, and hub audit reporting.
-- ------------------------------------------------------------------------------
CREATE INDEX idx_parcels_van_id_status ON parcels(van_id, status);
CREATE INDEX idx_parcels_zone_id ON parcels(zone_id);
CREATE INDEX idx_manifests_van_id ON manifests(van_id);
CREATE INDEX idx_manifests_open ON manifests(van_id) WHERE dispatched_at IS NULL;
CREATE INDEX idx_audit_log_parcel_id ON audit_log(parcel_id);
CREATE INDEX idx_audit_log_van_id ON audit_log(van_id);
CREATE INDEX idx_audit_log_timestamp ON audit_log(timestamp DESC);
