-- Fix schedule_next_season function signature and cache

-- 1. Drop the function with the old signature (if it exists) and new one to be clean
DROP FUNCTION IF EXISTS schedule_next_season(TIMESTAMPTZ);
DROP FUNCTION IF EXISTS schedule_next_season(TIMESTAMPTZ, INTEGER);

-- 2. Recreate the function with all parameters
CREATE OR REPLACE FUNCTION schedule_next_season(
    start_timestamp TIMESTAMPTZ,
    target_season_number INTEGER DEFAULT NULL
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
    
    -- Insert new season with is_active = FALSE
    INSERT INTO seasons (
        season_number,
        month,
        year,
        start_date,
        is_active
    ) VALUES (
        v_season_num,
        EXTRACT(MONTH FROM start_timestamp)::INTEGER,
        EXTRACT(YEAR FROM start_timestamp)::INTEGER,
        start_timestamp,
        FALSE -- Not active yet!
    )
    RETURNING id INTO v_new_season_id;

    RETURN v_new_season_id;
END;
$$;

-- 3. Reload the schema cache
NOTIFY pgrst, 'reload schema';
