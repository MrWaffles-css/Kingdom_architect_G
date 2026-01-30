-- season_management_v2.sql
-- Consolidated Season Status Logic
-- Replaces old maintenance mode functions

-- 1. Helper to set schedule
CREATE OR REPLACE FUNCTION set_season_schedule(
    p_start_time TIMESTAMPTZ DEFAULT NULL,
    p_end_time TIMESTAMPTZ DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Handle Start Time
    IF p_start_time IS NULL THEN
        DELETE FROM game_settings WHERE key = 'next_season_start';
    ELSE
        INSERT INTO game_settings (key, value, updated_at)
        VALUES ('next_season_start', jsonb_build_object('start_time', p_start_time), NOW())
        ON CONFLICT (key) DO UPDATE
        SET value = EXCLUDED.value, updated_at = NOW();
    END IF;

    -- Handle End Time
    IF p_end_time IS NULL THEN
        DELETE FROM game_settings WHERE key = 'season_end_time';
    ELSE
        -- Ensure this uses the correct key format used by your app
        -- Previously it might have been just a raw string or json. Let's standardize on JSON value.
        INSERT INTO game_settings (key, value, updated_at)
        VALUES ('season_end_time', jsonb_build_object('end_time', p_end_time), NOW())
        ON CONFLICT (key) DO UPDATE
        SET value = EXCLUDED.value, updated_at = NOW();
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION set_season_schedule(TIMESTAMPTZ, TIMESTAMPTZ) TO service_role; -- Only Admin/Service usually calls this, but we'll expose to auth if needed
GRANT EXECUTE ON FUNCTION set_season_schedule(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated; -- Needs RLS check on side if not restricted


-- 2. Main Status Getter
CREATE OR REPLACE FUNCTION get_system_status()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    is_maint_mode BOOLEAN := FALSE;
    start_time TIMESTAMPTZ;
    end_time TIMESTAMPTZ;
    
    maint_json JSONB;
    start_json JSONB;
    end_json JSONB;
    
    current_status TEXT := 'active'; -- Default
BEGIN
    -- Fetch all settings
    SELECT value INTO maint_json FROM game_settings WHERE key = 'maintenance_mode';
    SELECT value INTO start_json FROM game_settings WHERE key = 'next_season_start';
    SELECT value INTO end_json FROM game_settings WHERE key = 'season_end_time';
    
    -- Parse Maintenance
    IF maint_json IS NOT NULL THEN
        is_maint_mode := COALESCE((maint_json->>'enabled')::BOOLEAN, FALSE);
    END IF;
    
    -- Parse Times
    IF start_json IS NOT NULL THEN
        start_time := (start_json->>'start_time')::TIMESTAMPTZ;
    END IF;
    
    IF end_json IS NOT NULL THEN
        end_time := (end_json->>'end_time')::TIMESTAMPTZ;
        -- Fallback if stored as bare string (v1 compatibility)
        IF end_time IS NULL AND jsonb_typeof(end_json) = 'string' THEN
             end_time := (end_json#>>'{}')::TIMESTAMPTZ;
        END IF;
    END IF;
    
    -- Determine Status Priority
    
    -- 1. Manual Maintenance Override takes precedence? 
    -- Actually, usually standard "Season Ended" or "Waiting" is functionally maintenance for users,
    -- but "Maintenance" implies dev work.
    
    IF is_maint_mode THEN
        current_status := 'maintenance';
    ELSIF start_time IS NOT NULL AND start_time > NOW() THEN
        current_status := 'upcoming';
    ELSIF end_time IS NOT NULL AND end_time < NOW() THEN
        current_status := 'ended';
    ELSE
        current_status := 'active';
    END IF;

    RETURN jsonb_build_object(
        'status', current_status,
        'maintenance', is_maint_mode,
        'start_time', start_time,
        'end_time', end_time,
        'server_time', NOW()
    );
END;
$$;

GRANT EXECUTE ON FUNCTION get_system_status() TO anon, authenticated;

-- Notify
NOTIFY pgrst, 'reload schema';
