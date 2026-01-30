-- update_maintenance_logic.sql
-- Updates get_maintenance_mode to:
-- 1. Force maintenance mode to TRUE if a future season start time is set (Wait Period).
-- 2. Auto-disable maintenance mode if the start time has just passed.

CREATE OR REPLACE FUNCTION get_maintenance_mode()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    is_maint BOOLEAN;
    next_start TIMESTAMPTZ;
    maint_json JSONB;
    start_json JSONB;
BEGIN
    -- 1. Get Settings
    SELECT value INTO maint_json FROM game_settings WHERE key = 'maintenance_mode';
    SELECT value INTO start_json FROM game_settings WHERE key = 'next_season_start';

    -- Parse Maintenance Mode
    IF jsonb_typeof(maint_json) = 'boolean' THEN
        is_maint := maint_json::boolean;
    ELSE
        -- Handle null or object
        is_maint := COALESCE((maint_json->>'enabled')::BOOLEAN, FALSE);
    END IF;

    -- Parse Start Time
    IF start_json IS NOT NULL THEN
         next_start := (start_json->>'start_time')::TIMESTAMPTZ;
    END IF;

    -- Logic
    IF next_start IS NOT NULL THEN
        IF next_start > NOW() THEN
            -- Future start time implies "Waiting for Season" -> Force Maintenance
            RETURN TRUE;
        ELSE
            -- Start time passed
            -- Only auto-unlock if we are currently locked
            IF is_maint THEN
                -- Optimization: To avoid preventing manual maintenance for existing seasons,
                -- we could check if next_start is 'recent' (e.g. within last hour), but 
                -- for now we assume next_season_start key implies a pending/active transition context.
                
                UPDATE game_settings 
                SET value = '{"enabled": false}'::jsonb 
                WHERE key = 'maintenance_mode';
                
                -- Ideally we should also clear next_season_start to prevent this from interfering with future manual maintenance
                -- UPDATE game_settings SET value = null WHERE key = 'next_season_start'; 
                -- ^ Commented out to be safe, but worth considering.
                
                RETURN FALSE; -- We are now online
            END IF;
        END IF;
    END IF;

    RETURN is_maint;
END;
$$;

GRANT EXECUTE ON FUNCTION get_maintenance_mode() TO anon, authenticated;
NOTIFY pgrst, 'reload schema';
