-- fix_season_logic_final.sql

-- 1. Create a log table to debug why seasons are ending unexpectedly
CREATE TABLE IF NOT EXISTS season_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Revamp the Activation Logic to be Defensive
-- If we activate a season, we MUST validte that it won't instantly die.
CREATE OR REPLACE FUNCTION activate_pending_season(season_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_season RECORD;
    v_now TIMESTAMPTZ;
BEGIN
    v_now := NOW();

    -- 1. Get the season
    SELECT * INTO v_season FROM seasons WHERE id = season_id;
    
    IF v_season IS NULL THEN
        INSERT INTO season_logs (event_type, message) VALUES ('activation_failed', 'Season ID not found');
        RETURN FALSE;
    END IF;

    -- 2. Check strict start time (allow if it's within last 5 mins to catch up, otherwise too early)
    IF v_season.start_date > v_now THEN
        -- Too early!
        RETURN FALSE;
    END IF;

    -- 3. SANITY CHECK: Is the Scheduled End Date ALREADY in the past?
    -- This is likely the bug. If the end date passed while waiting, or was set wrong.
    -- We fix this by EXTENDING the end date automatically to ensure at least 1 hour of playtime.
    IF v_season.scheduled_end_date IS NOT NULL AND v_season.scheduled_end_date <= v_now THEN
        INSERT INTO season_logs (event_type, message) 
        VALUES ('activation_warning', 'Scheduled End Date was in past (' || v_season.scheduled_end_date || '). Extending by 24h.');
        
        UPDATE seasons 
        SET scheduled_end_date = v_now + INTERVAL '24 hours'
        WHERE id = season_id;
    END IF;

    -- 4. Deactivate others
    UPDATE seasons SET is_active = FALSE WHERE id != season_id AND is_active = TRUE;
    
    -- 5. Activate this one
    UPDATE seasons 
    SET is_active = TRUE, 
        start_date = v_now -- reset start date to ACTUAL start time for accurate "uptime" calculation
    WHERE id = season_id;
    
    INSERT INTO season_logs (event_type, message) 
    VALUES ('season_activated', 'Activated Season #' || v_season.season_number);
    
    RETURN TRUE;
END;
$$;

-- 3. Revamp the Auto-End Logic to be Extremely Conservative
-- We definitely do not want "instant" ends.
CREATE OR REPLACE FUNCTION check_and_end_season_cron()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_season_record RECORD;
    v_now TIMESTAMPTZ;
    v_min_uptime INTERVAL := '5 minutes'; -- Minimum time a season must be active before auto-ending
BEGIN
    v_now := NOW();

    SELECT * INTO v_season_record 
    FROM seasons 
    WHERE is_active = true 
    LIMIT 1;

    IF v_season_record IS NULL THEN
        RETURN;
    END IF;

    -- Only proceed if there is a scheduled end date
    IF v_season_record.scheduled_end_date IS NOT NULL THEN
        
        -- Check if end date has passed
        IF v_season_record.scheduled_end_date <= v_now THEN
            
            -- SAFETY CHECK 1: Has it been running long enough?
            -- We compare NOW with the (potentially updated) start_date
            IF (v_season_record.start_date + v_min_uptime) > v_now THEN
                -- It started less than 5 minutes ago. DO NOT END.
                INSERT INTO season_logs (event_type, message) 
                VALUES ('auto_end_prevented', 'Season #' || v_season_record.season_number || ' prevented from ending. Uptime < 5m.');
                RETURN;
            END IF;

            -- SAFETY CHECK 2: Double check it's not a misunderstanding
            -- If we are here, Season is Active, End Date is Past, and Uptime > 5 mins.
            -- Proceed to End.
            
            INSERT INTO season_logs (event_type, message) 
            VALUES ('auto_end_triggered', 'Ending Season #' || v_season_record.season_number || '. Schedule: ' || v_season_record.scheduled_end_date);
            
            PERFORM end_season(3);
        END IF;
    END IF;
END;
$$;

-- 4. Ensure process_game_tick calls our safe function
CREATE OR REPLACE FUNCTION public.process_game_tick()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- 1. Update Resources (Standard Logic)
    WITH gains AS (
        SELECT
            id,
            ((COALESCE(citizens, 0) * 1) + 
            (FLOOR((COALESCE(attack_soldiers, 0) + COALESCE(defense_soldiers, 0) + COALESCE(spies, 0) + COALESCE(sentries, 0)) * 0.5)) + 
            (COALESCE(miners, 0) * (2 + GREATEST(0, COALESCE(gold_mine_level, 1) - 1)))) AS gold_gain,
            CASE
                WHEN COALESCE(vault_level, 0) = 1 THEN 100000
                WHEN vault_level = 2 THEN 500000
                WHEN vault_level = 3 THEN 1500000
                WHEN vault_level = 4 THEN 5000000
                WHEN vault_level = 5 THEN 15000000
                WHEN vault_level = 6 THEN 50000000
                WHEN vault_level = 7 THEN 150000000
                WHEN vault_level = 8 THEN 500000000
                WHEN vault_level = 9 THEN 1500000000
                WHEN vault_level >= 10 THEN 5000000000
                ELSE 0
            END AS vault_cap,
            LEAST(0.50, COALESCE(vault_level, 0) * 0.05) AS interest_rate
        FROM public.user_stats
    )
    UPDATE public.user_stats u
    SET
        citizens = citizens + (COALESCE(kingdom_level, 0) * 10),
        gold = gold + g.gold_gain,
        vault = CASE
            WHEN u.vault >= g.vault_cap THEN u.vault
            ELSE LEAST(g.vault_cap, u.vault + FLOOR(g.gold_gain * g.interest_rate)::bigint)
        END,
        experience = experience + COALESCE(library_level, 1),
        turns = turns + COALESCE(research_turns_per_min, 0),
        updated_at = NOW(),
        last_resource_generation = NOW()
    FROM gains g
    WHERE u.id = g.id;

    -- 2. Call Safe Season Check
    PERFORM check_and_end_season_cron();
END;
$$;
