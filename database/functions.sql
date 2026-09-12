-- ==============================================================================
-- WAREHOUSE PARCEL DISPATCH & HUB TRANSIT TRACKER
-- STORED FUNCTIONS & CONCURRENCY LOGIC (PostgreSQL / Supabase)
-- ==============================================================================
-- This file implements the core warehouse business logic:
-- 1. load_parcel() - Validates parcel and vehicle constraints, locks rows with
--    SELECT FOR UPDATE to avoid race conditions, dynamically calculates current
--    load using SUM(weight_kg) for capacity checking, manages manifest items,
--    recalculates total vehicle load, and writes an audit log.
-- 2. dispatch_van() - Atomically updates loaded parcels to IN_TRANSIT, finalizes
--    the shipping manifest, sets vehicle to DISPATCHED, and writes an audit log.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- FUNCTION: load_parcel
-- Safely loads a single parcel into a designated van.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION load_parcel(
    p_parcel_id UUID,
    p_van_id UUID,
    p_actor_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_van vans%ROWTYPE;
    v_parcel parcels%ROWTYPE;
    v_calculated_current_load NUMERIC(10, 2);
    v_new_load NUMERIC(10, 2);
    v_manifest_id UUID;
    v_result JSONB;
BEGIN
    -- 1. CONCURRENCY CONTROL & ROW LOCKING
    -- Lock the target van row to prevent simultaneous load/dispatch operations
    SELECT * INTO v_van
    FROM vans
    WHERE id = p_van_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Van with ID % not found.', p_van_id
            USING ERRCODE = 'P0002';
    END IF;

    -- Validate that the van is in an acceptable operational state
    IF v_van.status = 'DISPATCHED' THEN
        RAISE EXCEPTION 'Cannot load parcel: Van % is already DISPATCHED.', v_van.plate_no
            USING ERRCODE = '22023';
    END IF;

    -- Lock the target parcel row to prevent double-assignment by concurrent scanners
    SELECT * INTO v_parcel
    FROM parcels
    WHERE id = p_parcel_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Parcel with ID % not found.', p_parcel_id
            USING ERRCODE = 'P0002';
    END IF;

    -- 2. STATUS VERIFICATION
    -- Only parcels in UNASSIGNED status may be loaded onto a vehicle
    IF v_parcel.status <> 'UNASSIGNED' THEN
        RAISE EXCEPTION 'Cannot load parcel %: Current status is "%" (expected "UNASSIGNED").',
            v_parcel.tracking_code, v_parcel.status
            USING ERRCODE = '22023';
    END IF;

    -- 3. ROUTING & ZONE VERIFICATION
    -- A parcel must belong to the exact operational zone serviced by the van
    IF v_parcel.zone_id <> v_van.zone_id THEN
        RAISE EXCEPTION 'Zone mismatch: Parcel % (Zone: %) cannot be loaded into Van % (Zone: %).',
            v_parcel.tracking_code, v_parcel.zone_id, v_van.plate_no, v_van.zone_id
            USING ERRCODE = '22023';
    END IF;

    -- 4. PRE-LOAD DYNAMIC CAPACITY CHECK
    -- Per requirements: Do NOT use the stored vans.current_load_kg for capacity decisions.
    -- Instead, calculate the actual current load directly by summing all currently LOADED parcels.
    SELECT COALESCE(SUM(weight_kg), 0.00)
    INTO v_calculated_current_load
    FROM parcels
    WHERE van_id = p_van_id
      AND status = 'LOADED';

    -- Check if adding the new parcel exceeds vehicle capacity
    IF (v_calculated_current_load + v_parcel.weight_kg) > v_van.capacity_kg THEN
        RAISE EXCEPTION 'Vehicle overload: Parcel % (% kg) exceeds Van % capacity (% kg). Current actual load: % kg, Available space: % kg.',
            v_parcel.tracking_code,
            v_parcel.weight_kg,
            v_van.plate_no,
            v_van.capacity_kg,
            v_calculated_current_load,
            (v_van.capacity_kg - v_calculated_current_load)
            USING ERRCODE = '22023';
    END IF;

    -- 5. OPEN MANIFEST RESOLUTION
    -- Search for an existing active (open) manifest for this van
    SELECT id
    INTO v_manifest_id
    FROM manifests
    WHERE van_id = p_van_id
      AND dispatched_at IS NULL
    ORDER BY created_at DESC
    LIMIT 1
    FOR UPDATE;

    -- If no open manifest exists for this van, automatically create one
    IF v_manifest_id IS NULL THEN
        INSERT INTO manifests (van_id, created_at)
        VALUES (p_van_id, NOW())
        RETURNING id INTO v_manifest_id;
    END IF;

    -- 6. ATOMIC PARCEL LOADING & MANIFEST ASSOCIATION
    -- Update parcel state to LOADED and associate with vehicle
    UPDATE parcels
    SET status = 'LOADED',
        van_id = p_van_id
    WHERE id = p_parcel_id;

    -- Associate parcel with the active manifest run
    INSERT INTO manifest_items (manifest_id, parcel_id)
    VALUES (v_manifest_id, p_parcel_id);

    -- 7. POST-LOAD CAPACITY RECALCULATION
    -- Recalculate SUM of all loaded parcels to synchronize stored current_load_kg
    SELECT COALESCE(SUM(weight_kg), 0.00)
    INTO v_new_load
    FROM parcels
    WHERE van_id = p_van_id
      AND status = 'LOADED';

    -- Update vehicle load cache and transition status to LOADING
    UPDATE vans
    SET current_load_kg = v_new_load,
        status = 'LOADING'
    WHERE id = p_van_id;

    -- 8. AUDIT LOG RECORDING
    -- Record immutable LOAD audit entry
    INSERT INTO audit_log (
        actor_id,
        action,
        parcel_id,
        van_id,
        timestamp,
        metadata
    ) VALUES (
        p_actor_id,
        'LOAD',
        p_parcel_id,
        p_van_id,
        NOW(),
        jsonb_build_object(
            'tracking_code', v_parcel.tracking_code,
            'parcel_weight_kg', v_parcel.weight_kg,
            'manifest_id', v_manifest_id,
            'previous_load_kg', v_calculated_current_load,
            'new_load_kg', v_new_load,
            'van_capacity_kg', v_van.capacity_kg
        )
    );

    -- Prepare detailed response payload
    v_result := jsonb_build_object(
        'success', true,
        'message', 'Parcel successfully loaded onto van.',
        'parcel_id', p_parcel_id,
        'tracking_code', v_parcel.tracking_code,
        'van_id', p_van_id,
        'van_plate_no', v_van.plate_no,
        'manifest_id', v_manifest_id,
        'previous_load_kg', v_calculated_current_load,
        'new_load_kg', v_new_load,
        'van_capacity_kg', v_van.capacity_kg
    );

    RETURN v_result;
END;
$$;

COMMENT ON FUNCTION load_parcel IS 'Atomically loads an unassigned parcel into a van, verifying zone and capacity via fresh SUM calculation with row-level locks';

-- ------------------------------------------------------------------------------
-- FUNCTION: dispatch_van
-- Atomically dispatches a van and all its loaded parcels into transit.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION dispatch_van(
    p_van_id UUID,
    p_actor_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_van vans%ROWTYPE;
    v_manifest_id UUID;
    v_parcel_count INT;
    v_total_weight NUMERIC(10, 2);
    v_dispatch_time TIMESTAMPTZ := NOW();
    v_result JSONB;
BEGIN
    -- 1. CONCURRENCY CONTROL & VEHICLE VALIDATION
    -- Lock vehicle row to prevent concurrent loading or duplicate dispatch
    SELECT * INTO v_van
    FROM vans
    WHERE id = p_van_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Van with ID % not found.', p_van_id
            USING ERRCODE = 'P0002';
    END IF;

    IF v_van.status = 'DISPATCHED' THEN
        RAISE EXCEPTION 'Van % is already DISPATCHED.', v_van.plate_no
            USING ERRCODE = '22023';
    END IF;

    -- 2. OPEN MANIFEST VALIDATION
    -- Locate open manifest associated with this vehicle run
    SELECT id
    INTO v_manifest_id
    FROM manifests
    WHERE van_id = p_van_id
      AND dispatched_at IS NULL
    ORDER BY created_at DESC
    LIMIT 1
    FOR UPDATE;

    IF v_manifest_id IS NULL THEN
        RAISE EXCEPTION 'Cannot dispatch Van %: No active open manifest exists.', v_van.plate_no
            USING ERRCODE = '22023';
    END IF;

    -- 3. CHECK LOADED PARCELS
    -- Ensure vehicle has at least one loaded parcel before departing
    SELECT
        COUNT(*),
        COALESCE(SUM(weight_kg), 0.00)
    INTO
        v_parcel_count,
        v_total_weight
    FROM parcels
    WHERE van_id = p_van_id
      AND status = 'LOADED';

    IF v_parcel_count = 0 THEN
        RAISE EXCEPTION 'Cannot dispatch Van %: Zero parcels are currently LOADED on this vehicle.', v_van.plate_no
            USING ERRCODE = '22023';
    END IF;

    -- 4. ATOMIC STATE TRANSITION
    -- Transition all LOADED parcels on this van to IN_TRANSIT
    UPDATE parcels
    SET status = 'IN_TRANSIT'
    WHERE van_id = p_van_id
      AND status = 'LOADED';

    -- Close the open manifest with dispatch timestamps and actor credentials
    UPDATE manifests
    SET dispatched_at = v_dispatch_time,
        dispatched_by = p_actor_id
    WHERE id = v_manifest_id;

    -- Transition vehicle status to DISPATCHED
    UPDATE vans
    SET status = 'DISPATCHED'
    WHERE id = p_van_id;

    -- 5. WRITE DISPATCH AUDIT LOG
    INSERT INTO audit_log (
        actor_id,
        action,
        parcel_id,
        van_id,
        timestamp,
        metadata
    ) VALUES (
        p_actor_id,
        'DISPATCH',
        NULL,
        p_van_id,
        v_dispatch_time,
        jsonb_build_object(
            'manifest_id', v_manifest_id,
            'van_plate_no', v_van.plate_no,
            'dispatched_parcels_count', v_parcel_count,
            'total_weight_kg', v_total_weight,
            'dispatched_at', v_dispatch_time
        )
    );

    -- Prepare summary return payload
    v_result := jsonb_build_object(
        'success', true,
        'message', 'Van and assigned parcels successfully dispatched.',
        'van_id', p_van_id,
        'van_plate_no', v_van.plate_no,
        'manifest_id', v_manifest_id,
        'dispatched_parcels_count', v_parcel_count,
        'total_weight_kg', v_total_weight,
        'dispatched_at', v_dispatch_time
    );

    RETURN v_result;
END;
$$;

COMMENT ON FUNCTION dispatch_van IS 'Atomically transitions all LOADED parcels to IN_TRANSIT, seals manifest, marks van as DISPATCHED, and writes audit record';
