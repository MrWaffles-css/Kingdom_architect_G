-- update_season_scheduling_v2.sql

-- 1. Update schedule_next_season to accept end_timestamp
-- Drop previous versions to be clean
DROP FUNCTION IF EXISTS schedule_next_season(TIMESTAMPTZ);
DROP FUNCTION IF EXISTS schedule_next_season(TIMESTAMPTZ, INTEGER);

CREATE OR REPLACE FUNCTION schedule_next_season(
    start_timestamp TIMESTAMPTZ,
    target_season_number INTEGER DEFAULT NULL,
    end_timestamp TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_last_season_number INTEGER;
    v_new_season_id UUID;
    v_season_num INTEGER;
BEGIN
    -- Check Admin
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true) THEN
        RAISE EXCEPTION 'Access denied: Admin only';
    END IF;

    -- Determine season number
    IF target_season_number IS NOT NULL THEN
        v_season_num := target_season_number;
    ELSE
        SELECT MAX(season_number) INTO v_last_season_number FROM seasons;
        v_season_num := COALESCE(v_last_season_number, 0) + 1;
    END IF;
    
    -- Insert new season
    INSERT INTO seasons (
        season_number,
        month,
        year,
        start_date,
        scheduled_end_date, -- Insert the end date if provided
        is_active
    ) VALUES (
        v_season_num,
        EXTRACT(MONTH FROM start_timestamp)::INTEGER,
        EXTRACT(YEAR FROM start_timestamp)::INTEGER,
        start_timestamp,
        end_timestamp,
        FALSE -- Not active yet!
    )
    RETURNING id INTO v_new_season_id;

    RETURN v_new_season_id;
END;
$$;


-- 2. Create activate_pending_season RPC
-- This allows the FRONTEND to trigger the season start if the time has passed.
-- This is "Lazy Activation" to avoid needing a complex server-side cron.
CREATE OR REPLACE FUNCTION activate_pending_season(season_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_season RECORD;
BEGIN
    -- 1. Get the season
    SELECT * INTO v_season FROM seasons WHERE id = season_id;
    
    IF v_season IS NULL THEN
        RETURN FALSE;
    END IF;

    -- 2. Check time
    IF v_season.start_date > NOW() THEN
        -- Too early!
        RETURN FALSE;
    END IF;

    -- 3. Activate
    -- Deactivate all others first (safety)
    UPDATE seasons SET is_active = FALSE WHERE id != season_id AND is_active = TRUE;
    
    -- Activate this one
    UPDATE seasons SET is_active = TRUE WHERE id = season_id;
    
    RETURN TRUE;
END;
$$;

-- 3. Grant Permissions
-- Public needs to be able to trigger activation (if time is right)
GRANT EXECUTE ON FUNCTION activate_pending_season(UUID) TO anon, authenticated;

-- 4. Reload Schema
NOTIFY pgrst, 'reload schema';
