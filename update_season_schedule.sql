-- update_season_schedule.sql
-- Adds scheduled end date to seasons and logic to enforce it.

-- 1. Add scheduled_end_date column
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'seasons' AND column_name = 'scheduled_end_date') THEN
        ALTER TABLE seasons ADD COLUMN scheduled_end_date TIMESTAMPTZ;
    END IF;
END $$;

-- 2. Function for Admin to set the schedule
CREATE OR REPLACE FUNCTION set_season_end_date(target_date TIMESTAMPTZ)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_season_id UUID;
BEGIN
    -- Check if user is admin
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true) THEN
        RAISE EXCEPTION 'Access denied: Admin only';
    END IF;

    -- Get active season
    SELECT id INTO v_season_id FROM seasons WHERE is_active = true LIMIT 1;
    
    IF v_season_id IS NULL THEN
        RAISE EXCEPTION 'No active season found';
    END IF;

    UPDATE seasons 
    SET scheduled_end_date = target_date
    WHERE id = v_season_id;
END;
$$;

-- 3. Utility to get server time (for frontend sync)
CREATE OR REPLACE FUNCTION get_server_time()
RETURNS TIMESTAMPTZ
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT NOW();
$$;

-- 4. Function to check and auto-end season
-- This should be called by the game tick cron
CREATE OR REPLACE FUNCTION check_and_end_season_cron()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_season_record RECORD;
BEGIN
    SELECT * INTO v_season_record 
    FROM seasons 
    WHERE is_active = true 
    LIMIT 1;

    -- If active season has a passed schedule, END IT.
    IF v_season_record.scheduled_end_date IS NOT NULL AND v_season_record.scheduled_end_date <= NOW() THEN
        -- Call the existing end_season function
        -- Default cooldown of 3 hours if auto-ended, or we could make it configurable
        PERFORM end_season(3);
    END IF;
END;
$$;
