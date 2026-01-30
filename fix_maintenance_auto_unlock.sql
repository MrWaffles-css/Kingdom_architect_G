-- fix_maintenance_auto_unlock.sql
-- Fixes the issue where manual maintenance toggles are overridden by "Season Start" logic repeatedly.
-- Also implements auto-locking when a Season expires.

CREATE OR REPLACE FUNCTION get_maintenance_mode()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    is_maint_setting BOOLEAN;
    maint_json JSONB;
    
    -- Season Schedule Vars
    start_json JSONB;
    start_timestamp TIMESTAMPTZ;
    is_processed BOOLEAN;
    
    -- End Season Vars
    season_expired BOOLEAN;
BEGIN
    -- 1. Get current setting from DB
    SELECT value INTO maint_json FROM game_settings WHERE key = 'maintenance_mode';
    
    -- Parse JSON boolean
    IF jsonb_typeof(maint_json) = 'boolean' THEN
        is_maint_setting := maint_json::boolean;
    ELSE
        is_maint_setting := COALESCE((maint_json->>'enabled')::BOOLEAN, FALSE);
    END IF;

    -- 2. AUTO-LOCK: Check if the current active season has expired
    -- Only check if we are currently Online (if already in maintenance, no need to auto-lock again)
    IF is_maint_setting IS FALSE THEN
        SELECT EXISTS(
            SELECT 1 FROM seasons 
            WHERE is_active = TRUE 
            AND scheduled_end_date IS NOT NULL 
            AND NOW() > scheduled_end_date
        ) INTO season_expired;
        
        IF season_expired THEN
             -- Season is over! Lock the server.
             UPDATE game_settings SET value = '{"enabled": true}'::jsonb WHERE key = 'maintenance_mode';
             is_maint_setting := TRUE; -- Update local var to reflect new state
        END IF;
    END IF;

    -- 3. AUTO-UNLOCK & WAIT PERIOD: Check Next Season Start
    SELECT value INTO start_json FROM game_settings WHERE key = 'next_season_start';
    
    IF start_json IS NOT NULL THEN
         start_timestamp := (start_json->>'start_time')::TIMESTAMPTZ;
         is_processed := COALESCE((start_json->>'processed')::BOOLEAN, FALSE);
         
         -- Only apply logic if this start time hasn't been "consumed" yet
         IF start_timestamp IS NOT NULL AND is_processed IS FALSE THEN
         
            IF NOW() < start_timestamp THEN
                -- FUTURE: We are in the pre-season waiting room.
                -- FORCE Maintenance Mode regardless of setting (unless we want to allow admins to unlock early? 
                -- Usually 'Wait Period' is strict. Admin can bypass via is_admin check in frontend).
                RETURN TRUE;
                
            ELSE
                -- PAST: The wait is over!
                -- If we are currently locked, AUTO-UNLOCK.
                IF is_maint_setting THEN
                    UPDATE game_settings SET value = '{"enabled": false}'::jsonb WHERE key = 'maintenance_mode';
                    is_maint_setting := FALSE;
                END IF;
                
                -- MARK AS PROCESSED so this specific timestamp doesn't trigger/interfere again.
                -- This solves the "Manual Turn Off" bug.
                UPDATE game_settings 
                SET value = jsonb_set(start_json, '{processed}', 'true'::jsonb)
                WHERE key = 'next_season_start';
                
            END IF;
         END IF;
    END IF;

    RETURN is_maint_setting;
END;
$$;

GRANT EXECUTE ON FUNCTION get_maintenance_mode() TO anon, authenticated;
NOTIFY pgrst, 'reload schema';
