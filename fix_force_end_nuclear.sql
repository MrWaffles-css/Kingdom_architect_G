-- fix_force_end_nuclear.sql

-- 1. Make 'Force End' truly GLOBAL/NUCLEAR
-- We don't care about ID matches. If the admin says "End it", we end EVERYTHING active.
CREATE OR REPLACE FUNCTION admin_end_season_now(p_season_id UUID DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Admin Check
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true) THEN
        RAISE EXCEPTION 'Access denied: Admin only';
    END IF;

    -- Deactivate ALL active seasons
    UPDATE seasons 
    SET is_active = FALSE,
        scheduled_end_date = LEAST(scheduled_end_date, NOW()) -- Ensure end date is capped at now
    WHERE is_active = TRUE;

    RETURN TRUE;
END;
$$;

-- 2. Improved Dashboard to detect "Zombie" seasons (Active but finished??)
-- We stick to the previous dashboard logic but ensure we return explicit flags.
CREATE OR REPLACE FUNCTION get_admin_season_dashboard()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_active_season JSONB;
    v_next_scheduled JSONB;
    v_last_ended JSONB;
    v_server_time TIMESTAMPTZ;
BEGIN
    v_server_time := NOW();

    -- Get Active
    SELECT to_jsonb(s.*) INTO v_active_season 
    FROM seasons s 
    WHERE s.is_active = TRUE 
    LIMIT 1;

    -- Get Next Scheduled (Future Start, Not Active)
    SELECT to_jsonb(s.*) INTO v_next_scheduled 
    FROM seasons s 
    WHERE s.is_active = FALSE AND s.start_date > v_server_time 
    ORDER BY s.start_date ASC 
    LIMIT 1;

    -- Get Last Ended (Past Start, Not Active)
    SELECT to_jsonb(s.*) INTO v_last_ended 
    FROM seasons s 
    WHERE s.is_active = FALSE AND s.start_date <= v_server_time 
    ORDER BY s.start_date DESC 
    LIMIT 1;

    RETURN jsonb_build_object(
        'active', v_active_season,
        'next', v_next_scheduled,
        'last', v_last_ended,
        'server_time', v_server_time
    );
END;
$$;

-- 3. Fix the "Schedule Next" RPC to allow overwriting if needed
-- If we want to schedule Season #2 but it already exists (from a previous failed attempt), just update it.
CREATE OR REPLACE FUNCTION admin_schedule_season(
    p_season_number INTEGER,
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_season_id UUID;
    v_month INT;
    v_year INT;
BEGIN
    -- Admin Check
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true) THEN
        RAISE EXCEPTION 'Access denied: Admin only';
    END IF;

    -- Validation
    IF p_end_date IS NOT NULL AND p_end_date <= p_start_date THEN
        RAISE EXCEPTION 'End date must be after start date';
    END IF;

    v_month := EXTRACT(MONTH FROM p_start_date)::INTEGER;
    v_year := EXTRACT(YEAR FROM p_start_date)::INTEGER;

    -- Upsert Season
    INSERT INTO seasons (
        season_number,
        month,
        year,
        start_date,
        scheduled_end_date,
        is_active
    ) VALUES (
        p_season_number,
        v_month,
        v_year,
        p_start_date,
        p_end_date,
        FALSE
    )
    ON CONFLICT (season_number) 
    DO UPDATE SET
        month = EXCLUDED.month,
        year = EXCLUDED.year,
        start_date = EXCLUDED.start_date,
        scheduled_end_date = EXCLUDED.scheduled_end_date,
        is_active = FALSE -- Reset to waiting status
    RETURNING id INTO v_season_id;

    RETURN v_season_id;
END;
$$;
