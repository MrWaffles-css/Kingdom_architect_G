-- diagnose_season_issue.sql

CREATE OR REPLACE FUNCTION get_season_debug_info()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_season RECORD;
    v_server_time TIMESTAMPTZ;
BEGIN
    v_server_time := NOW();
    
    SELECT * INTO v_season FROM seasons WHERE is_active = true LIMIT 1;
    
    IF v_season IS NULL THEN
        RETURN jsonb_build_object(
            'status', 'no_active_season',
            'server_time', v_server_time
        );
    END IF;
    
    RETURN jsonb_build_object(
        'status', 'active_season_found',
        'season_id', v_season.id,
        'season_number', v_season.season_number,
        'start_date', v_season.start_date,
        'scheduled_end_date', v_season.scheduled_end_date,
        'server_time', v_server_time,
        'should_end', (v_season.scheduled_end_date IS NOT NULL AND v_season.scheduled_end_date <= v_server_time)
    );
END;
$$;
