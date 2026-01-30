-- auto_unlock_season.sql
-- Updates get_maintenance_mode to automatically disable maintenance if the season start time has passed.

CREATE OR REPLACE FUNCTION get_maintenance_mode()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with elevated privileges to allow updating game_settings
AS $$
DECLARE
    is_maint BOOLEAN;
    next_start TIMESTAMPTZ;
    maint_json JSONB;
    start_json JSONB;
BEGIN
    -- 1. Get current maintenance status
    SELECT value INTO maint_json FROM game_settings WHERE key = 'maintenance_mode';
    
    -- Default to false if key missing, otherwise extract 'enabled'
    -- Support both {"enabled": true} and "true" (if direct jsonb bool) just in case, but usually it's an object
    IF jsonb_typeof(maint_json) = 'boolean' THEN
        is_maint := maint_json::boolean;
    ELSE
        is_maint := COALESCE((maint_json->>'enabled')::BOOLEAN, FALSE);
    END IF;

    -- 2. If in maintenance, check if we should be out of it
    IF is_maint THEN
        SELECT value INTO start_json FROM game_settings WHERE key = 'next_season_start';
        
        IF start_json IS NOT NULL THEN
             next_start := (start_json->>'start_time')::TIMESTAMPTZ;
             
             -- Check if start time is defined and passed
             IF next_start IS NOT NULL AND NOW() >= next_start THEN
                -- TIME IS UP! DISABLE MAINTENANCE MODE
                
                -- Update the setting
                -- We use ON CONFLICT just in case, though UPDATE is safer for existing key
                UPDATE game_settings 
                SET value = '{"enabled": false}'::jsonb 
                WHERE key = 'maintenance_mode';
                
                -- Also clear the start time so we don't re-trigger weirdly? 
                -- Actually keeping it is fine as a record, or maybe clear it to show "Season In Progress".
                -- For now, let's just unlock.
                
                RETURN FALSE; -- We are now online
             END IF;
        END IF;
    END IF;

    RETURN is_maint;
END;
$$;

-- Grant access to everyone so the first person to hit the site unlocks it
GRANT EXECUTE ON FUNCTION get_maintenance_mode() TO anon, authenticated;

-- Notify schema reload
NOTIFY pgrst, 'reload schema';
