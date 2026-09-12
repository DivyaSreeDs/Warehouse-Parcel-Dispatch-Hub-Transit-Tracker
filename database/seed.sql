-- ==============================================================================
-- WAREHOUSE PARCEL DISPATCH & HUB TRANSIT TRACKER
-- SEED DATA SCRIPT (PostgreSQL / Supabase)
-- ==============================================================================
-- This script seeds the database with realistic sample records:
-- 1. North Zone (PIN prefixes: 110, 111, 112)
-- 2. South Zone (PIN prefixes: 560, 561, 562)
-- 3. Sample delivery vans for both North and South zones
-- 4. Sample parcels in various weights and zones for testing workflows
-- ==============================================================================

-- Clear any existing records to guarantee clean initial state
TRUNCATE TABLE manifest_items, manifests, audit_log, parcels, vans, zones CASCADE;

-- ------------------------------------------------------------------------------
-- 1. SEED ZONES
-- ------------------------------------------------------------------------------
INSERT INTO zones (id, name, pin_prefix_rules) VALUES
(
    '11111111-1111-1111-1111-111111111111',
    'North Zone',
    ARRAY['110', '111', '112']
),
(
    '22222222-2222-2222-2222-222222222222',
    'South Zone',
    ARRAY['560', '561', '562']
);

-- ------------------------------------------------------------------------------
-- 2. SEED VANS
-- ------------------------------------------------------------------------------
INSERT INTO vans (id, plate_no, zone_id, capacity_kg, current_load_kg, status) VALUES
(
    'aaaaaaa1-1111-1111-1111-111111111111',
    'VAN-NZ-01',
    '11111111-1111-1111-1111-111111111111', -- North Zone
    500.00,
    0.00,
    'AVAILABLE'
),
(
    'aaaaaaa2-1111-1111-1111-111111111111',
    'VAN-NZ-02',
    '11111111-1111-1111-1111-111111111111', -- North Zone
    250.00,
    0.00,
    'AVAILABLE'
),
(
    'bbbbbbb1-2222-2222-2222-222222222222',
    'VAN-SZ-01',
    '22222222-2222-2222-2222-222222222222', -- South Zone
    300.00,
    0.00,
    'AVAILABLE'
);

-- ------------------------------------------------------------------------------
-- 3. SEED PARCELS
-- ------------------------------------------------------------------------------
-- North Zone Standard Parcels
INSERT INTO parcels (id, tracking_code, pin_code, weight_kg, zone_id, status) VALUES
(
    'c0000001-1111-1111-1111-111111111111',
    'TRK-NZ-001',
    '110001',
    25.50,
    '11111111-1111-1111-1111-111111111111', -- North Zone
    'UNASSIGNED'
),
(
    'c0000002-1111-1111-1111-111111111111',
    'TRK-NZ-002',
    '110002',
    40.00,
    '11111111-1111-1111-1111-111111111111', -- North Zone
    'UNASSIGNED'
),
(
    'c0000003-1111-1111-1111-111111111111',
    'TRK-NZ-003',
    '111001',
    35.00,
    '11111111-1111-1111-1111-111111111111', -- North Zone
    'UNASSIGNED'
),
-- North Zone Overload Candidate (550 kg > 500 kg capacity of VAN-NZ-01)
(
    'c0000004-1111-1111-1111-111111111111',
    'TRK-NZ-OVERLOAD',
    '111002',
    550.00,
    '11111111-1111-1111-1111-111111111111', -- North Zone
    'UNASSIGNED'
);

-- South Zone Standard Parcels
INSERT INTO parcels (id, tracking_code, pin_code, weight_kg, zone_id, status) VALUES
(
    'd0000001-2222-2222-2222-222222222222',
    'TRK-SZ-001',
    '560001',
    15.00,
    '22222222-2222-2222-2222-222222222222', -- South Zone
    'UNASSIGNED'
),
(
    'd0000002-2222-2222-2222-222222222222',
    'TRK-SZ-002',
    '560002',
    50.00,
    '22222222-2222-2222-2222-222222222222', -- South Zone
    'UNASSIGNED'
);

-- Initial SCAN audit records for received parcels
INSERT INTO audit_log (action, parcel_id, metadata)
SELECT
    'SCAN',
    id,
    jsonb_build_object('event', 'INBOUND_RECEIVING', 'tracking_code', tracking_code, 'weight_kg', weight_kg)
FROM parcels;
