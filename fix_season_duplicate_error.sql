-- Fix duplicate key error by using Upsert logic

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
    
    -- Upsert: Insert or Update if season number exists
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
        FALSE -- Always starts inactive, waits for timer/activation
    )
    ON CONFLICT (season_number) 
    DO UPDATE SET
        month = EXCLUDED.month,
        year = EXCLUDED.year,
        start_date = EXCLUDED.start_date,
        scheduled_end_date = EXCLUDED.scheduled_end_date,
        is_active = FALSE -- Reset to inactive if we are rescheduling it
    RETURNING id INTO v_new_season_id;

    RETURN v_new_season_id;
END;
$$;

NOTIFY pgrst, 'reload schema';
