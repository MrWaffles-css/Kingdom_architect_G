-- Create a v2 function to strictly avoid any caching or signature overlap issues
CREATE OR REPLACE FUNCTION schedule_next_season_v2(
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
    
    -- Upsert Logic
    INSERT INTO seasons (
        season_number,
        month,
        year,
        start_date,
        scheduled_end_date,
        is_active
    ) VALUES (
        v_season_num,
        EXTRACT(MONTH FROM start_timestamp)::INTEGER,
        EXTRACT(YEAR FROM start_timestamp)::INTEGER,
        start_timestamp,
        end_timestamp,
        FALSE
    )
    ON CONFLICT (season_number) 
    DO UPDATE SET
        month = EXCLUDED.month,
        year = EXCLUDED.year,
        start_date = EXCLUDED.start_date,
        scheduled_end_date = EXCLUDED.scheduled_end_date,
        is_active = FALSE
    RETURNING id INTO v_new_season_id;

    RETURN v_new_season_id;
END;
$$;

-- Grant permissions explicitly
GRANT EXECUTE ON FUNCTION schedule_next_season_v2(TIMESTAMPTZ, INTEGER, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION schedule_next_season_v2(TIMESTAMPTZ, INTEGER, TIMESTAMPTZ) TO anon;
GRANT EXECUTE ON FUNCTION schedule_next_season_v2(TIMESTAMPTZ, INTEGER, TIMESTAMPTZ) TO service_role;

NOTIFY pgrst, 'reload schema';
