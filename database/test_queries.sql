-- ==============================================================================
-- WAREHOUSE PARCEL DISPATCH & HUB TRANSIT TRACKER
-- TEST QUERIES & VALIDATION SUITE (PostgreSQL / Supabase)
-- ==============================================================================
-- This test script systematically validates all integrity constraints,
-- business rule assertions, stored procedures, and audit immutability.
--
-- Each test is designed to run cleanly inside a PostgreSQL anonymous DO block
-- so it can catch expected exceptions and report a clear PASS / FAIL verdict.
-- You can run the entire file in Supabase SQL Editor or via psql CLI.
-- ==============================================================================

\echo '========================================================'
\echo 'STARTING WAREHOUSE DISPATCH & HUB TRACKER TEST SUITE'
\echo '========================================================'

-- ------------------------------------------------------------------------------
-- TEST 1: DUPLICATE TRACKING CODE
-- Requirement: tracking_code must be UNIQUE across all parcels.
-- Expected Result: unique_violation error (Postgres error code 23505).
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    RAISE NOTICE '------------------------------------------------------------';
    RAISE NOTICE '[TEST 1] Testing Duplicate Tracking Code constraint...';

    -- Attempt to insert a second parcel with an already existing tracking code 'TRK-NZ-001'
    INSERT INTO parcels (tracking_code, pin_code, weight_kg, zone_id, status)
    VALUES ('TRK-NZ-001', '110099', 10.00, '11111111-1111-1111-1111-111111111111', 'UNASSIGNED');

    RAISE EXCEPTION 'TEST 1 FAILED: Duplicate tracking_code was accepted without error!';
EXCEPTION
    WHEN unique_violation THEN
        RAISE NOTICE '[TEST 1 PASSED]: Duplicate tracking_code correctly blocked by UNIQUE constraint (SQLSTATE: %).', SQLSTATE;
END;
$$;

-- ------------------------------------------------------------------------------
-- TEST 2: NEGATIVE OR ZERO PARCEL WEIGHT
-- Requirement: weight_kg must be strictly greater than 0.
-- Expected Result: check_violation error (Postgres error code 23514).
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    RAISE NOTICE '------------------------------------------------------------';
    RAISE NOTICE '[TEST 2] Testing Negative Parcel Weight CHECK constraint...';

    -- Attempt to insert a parcel with an invalid negative weight (-15.50 kg)
    INSERT INTO parcels (tracking_code, pin_code, weight_kg, zone_id, status)
    VALUES ('TRK-INVALID-WEIGHT', '110099', -15.50, '11111111-1111-1111-1111-111111111111', 'UNASSIGNED');

    RAISE EXCEPTION 'TEST 2 FAILED: Negative parcel weight was accepted!';
EXCEPTION
    WHEN check_violation THEN
        RAISE NOTICE '[TEST 2 PASSED]: Negative parcel weight correctly blocked by CHECK(weight_kg > 0) constraint (SQLSTATE: %).', SQLSTATE;
END;
$$;

-- ------------------------------------------------------------------------------
-- TEST 3: WRONG-ZONE PARCEL
-- Requirement: load_parcel() must reject parcels belonging to a different zone.
-- South Zone Parcel: 'd0000001-2222-2222-2222-222222222222'
-- North Zone Van:    'aaaaaaa1-1111-1111-1111-111111111111'
-- Expected Result: Custom exception 'Zone mismatch'.
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    v_south_parcel_id UUID := 'd0000001-2222-2222-2222-222222222222';
    v_north_van_id    UUID := 'aaaaaaa1-1111-1111-1111-111111111111';
BEGIN
    RAISE NOTICE '------------------------------------------------------------';
    RAISE NOTICE '[TEST 3] Testing Wrong-Zone Parcel rejection...';

    -- Call load_parcel() with mismatched zone entities
    PERFORM load_parcel(v_south_parcel_id, v_north_van_id);

    RAISE EXCEPTION 'TEST 3 FAILED: South Zone parcel was erroneously loaded into North Zone van!';
EXCEPTION
    WHEN OTHERS THEN
        IF SQLERRM LIKE '%Zone mismatch%' THEN
            RAISE NOTICE '[TEST 3 PASSED]: load_parcel() correctly rejected wrong-zone parcel. Message: "%"', SQLERRM;
        ELSE
            RAISE EXCEPTION 'TEST 3 UNEXPECTED ERROR: %', SQLERRM;
        END IF;
END;
$$;

-- ------------------------------------------------------------------------------
-- TEST 4: VEHICLE OVERLOAD (DYNAMIC SUM CHECK)
-- Requirement: load_parcel() calculates actual load via SUM(weight_kg) of LOADED
-- parcels and rejects parcels that would exceed the van's capacity_kg.
-- Van VAN-NZ-01 Capacity: 500.00 kg
-- Overload Parcel:        550.00 kg ('c0000004-1111-1111-1111-111111111111')
-- Expected Result: Custom exception 'Vehicle overload'.
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    v_overload_parcel_id UUID := 'c0000004-1111-1111-1111-111111111111';
    v_north_van_id       UUID := 'aaaaaaa1-1111-1111-1111-111111111111';
BEGIN
    RAISE NOTICE '------------------------------------------------------------';
    RAISE NOTICE '[TEST 4] Testing Vehicle Overload rejection via dynamic SUM...';

    -- Call load_parcel() with 550kg parcel into 500kg capacity van
    PERFORM load_parcel(v_overload_parcel_id, v_north_van_id);

    RAISE EXCEPTION 'TEST 4 FAILED: Overweight parcel was loaded without capacity rejection!';
EXCEPTION
    WHEN OTHERS THEN
        IF SQLERRM LIKE '%Vehicle overload%' THEN
            RAISE NOTICE '[TEST 4 PASSED]: load_parcel() correctly blocked vehicle overload. Message: "%"', SQLERRM;
        ELSE
            RAISE EXCEPTION 'TEST 4 UNEXPECTED ERROR: %', SQLERRM;
        END IF;
END;
$$;

-- ------------------------------------------------------------------------------
-- TEST 5: SUCCESSFUL LOADING & DISPATCH WORKFLOW
-- Requirement:
-- 1. Load parcel 1 (25.50 kg) into North Van 1.
-- 2. Load parcel 2 (40.00 kg) into North Van 1.
-- 3. Verify current_load_kg is recalculated as exact SUM (65.50 kg).
-- 4. Dispatch the van atomically: parcels -> IN_TRANSIT, van -> DISPATCHED,
--    manifest finalized with timestamp and actor, and DISPATCH audit record logged.
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    v_parcel_1_id UUID := 'c0000001-1111-1111-1111-111111111111'; -- 25.50 kg
    v_parcel_2_id UUID := 'c0000002-1111-1111-1111-111111111111'; -- 40.00 kg
    v_van_id      UUID := 'aaaaaaa1-1111-1111-1111-111111111111';
    v_actor_id    UUID := '99999999-9999-9999-9999-999999999999';
    v_van_rec     RECORD;
    v_manifest_rec RECORD;
    v_load_res    JSONB;
    v_dispatch_res JSONB;
    v_audit_count INT;
BEGIN
    RAISE NOTICE '------------------------------------------------------------';
    RAISE NOTICE '[TEST 5] Testing End-to-End Successful Loading & Dispatch Workflow...';

    -- Step 5A: Load first parcel (25.50 kg)
    v_load_res := load_parcel(v_parcel_1_id, v_van_id, v_actor_id);
    RAISE NOTICE 'Loaded Parcel 1: %', v_load_res;

    -- Step 5B: Load second parcel (40.00 kg)
    v_load_res := load_parcel(v_parcel_2_id, v_van_id, v_actor_id);
    RAISE NOTICE 'Loaded Parcel 2: %', v_load_res;

    -- Step 5C: Verify van load recalculation (must equal exact SUM: 25.50 + 40.00 = 65.50 kg)
    SELECT current_load_kg, status INTO v_van_rec FROM vans WHERE id = v_van_id;
    IF v_van_rec.current_load_kg <> 65.50 THEN
        RAISE EXCEPTION 'TEST 5 FAILED: Expected van load to be 65.50 kg, but found % kg!', v_van_rec.current_load_kg;
    END IF;

    IF v_van_rec.status <> 'LOADING' THEN
        RAISE EXCEPTION 'TEST 5 FAILED: Expected van status to be "LOADING", but found "%"!', v_van_rec.status;
    END IF;
    RAISE NOTICE 'Verified: Van load accurately recalculated via SUM to % kg in status %.', v_van_rec.current_load_kg, v_van_rec.status;

    -- Step 5D: Dispatch the van atomically
    v_dispatch_res := dispatch_van(v_van_id, v_actor_id);
    RAISE NOTICE 'Dispatched Van: %', v_dispatch_res;

    -- Step 5E: Verify post-dispatch states
    -- 1. Van must be DISPATCHED
    SELECT current_load_kg, status INTO v_van_rec FROM vans WHERE id = v_van_id;
    IF v_van_rec.status <> 'DISPATCHED' THEN
        RAISE EXCEPTION 'TEST 5 FAILED: Expected van status to be "DISPATCHED", but found "%"!', v_van_rec.status;
    END IF;

    -- 2. Loaded parcels must now be IN_TRANSIT
    IF EXISTS (
        SELECT 1 FROM parcels
        WHERE id IN (v_parcel_1_id, v_parcel_2_id)
          AND status <> 'IN_TRANSIT'
    ) THEN
        RAISE EXCEPTION 'TEST 5 FAILED: One or more parcels were not set to IN_TRANSIT!';
    END IF;

    -- 3. Manifest must have dispatched_at and dispatched_by populated
    SELECT * INTO v_manifest_rec FROM manifests WHERE van_id = v_van_id;
    IF v_manifest_rec.dispatched_at IS NULL OR v_manifest_rec.dispatched_by <> v_actor_id THEN
        RAISE EXCEPTION 'TEST 5 FAILED: Manifest dispatch metadata was not properly sealed!';
    END IF;

    -- 4. Audit log must record both LOAD and DISPATCH actions
    SELECT COUNT(*) INTO v_audit_count
    FROM audit_log
    WHERE van_id = v_van_id AND action IN ('LOAD', 'DISPATCH');

    IF v_audit_count < 3 THEN -- 2 loads + 1 dispatch
        RAISE EXCEPTION 'TEST 5 FAILED: Expected at least 3 audit entries for van, found %!', v_audit_count;
    END IF;

    RAISE NOTICE '[TEST 5 PASSED]: Full loading and dispatch lifecycle executed with 100%% atomic consistency.';
END;
$$;

-- ------------------------------------------------------------------------------
-- TEST 6: IMMUTABLE AUDIT LOG ENFORCEMENT
-- Requirement: UPDATE and DELETE on audit_log must be blocked by trigger.
-- Expected Result: Exception 'audit_log is immutable'.
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    v_sample_id UUID;
BEGIN
    RAISE NOTICE '------------------------------------------------------------';
    RAISE NOTICE '[TEST 6A] Testing Audit Log UPDATE prevention...';

    SELECT id INTO v_sample_id FROM audit_log LIMIT 1;

    -- Attempt an UPDATE on audit_log
    UPDATE audit_log
    SET metadata = '{"tampered": true}'::jsonb
    WHERE id = v_sample_id;

    RAISE EXCEPTION 'TEST 6A FAILED: UPDATE on audit_log succeeded!';
EXCEPTION
    WHEN OTHERS THEN
        IF SQLERRM LIKE '%audit_log is immutable%' THEN
            RAISE NOTICE '[TEST 6A PASSED]: UPDATE on audit_log was rejected. Message: "%"', SQLERRM;
        ELSE
            RAISE EXCEPTION 'TEST 6A UNEXPECTED ERROR: %', SQLERRM;
        END IF;
END;
$$;

DO $$
DECLARE
    v_sample_id UUID;
BEGIN
    RAISE NOTICE '------------------------------------------------------------';
    RAISE NOTICE '[TEST 6B] Testing Audit Log DELETE prevention...';

    SELECT id INTO v_sample_id FROM audit_log LIMIT 1;

    -- Attempt a DELETE on audit_log
    DELETE FROM audit_log
    WHERE id = v_sample_id;

    RAISE EXCEPTION 'TEST 6B FAILED: DELETE from audit_log succeeded!';
EXCEPTION
    WHEN OTHERS THEN
        IF SQLERRM LIKE '%audit_log is immutable%' THEN
            RAISE NOTICE '[TEST 6B PASSED]: DELETE on audit_log was rejected. Message: "%"', SQLERRM;
        ELSE
            RAISE EXCEPTION 'TEST 6B UNEXPECTED ERROR: %', SQLERRM;
        END IF;
END;
$$;

\echo '========================================================'
\echo 'ALL TEST SUITE SCENARIOS EXECUTED AND VERIFIED SUCCESSFULLY'
\echo '========================================================'
