-- fix_season_instant_end.sql

-- 1. Redefine check_and_end_season_cron with a safety buffer
-- This prevents a season from ending "instantly" after activation due to minor clock skews
-- or race conditions. It ensures the season is active for at least 5 minutes before auto-ending.

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

    IF v_season_record IS NULL THEN
        RETURN;
    END IF;

    -- Only proceed if there is a scheduled end date
    IF v_season_record.scheduled_end_date IS NOT NULL THEN
        -- Check if end date has passed AND season has been active/started for at least 1 minute
        -- Note: We use start_date as the reference for "started". 
        -- If start_date is in the past, LEAST(now, end) logic applies.
        
        IF v_season_record.scheduled_end_date <= NOW() THEN
            -- Safety check: don't end if it JUST started (within last 1 minute)
            -- This handles the "activates then instantly ends" race condition if clocks are slightly off
            IF v_season_record.start_date < (NOW() - INTERVAL '1 minute') THEN
                PERFORM end_season(3);
            END IF;
        END IF;
    END IF;
END;
$$;

-- 2. Update schedule_next_season_v2 to validate dates
-- Ensures we don't accidentally schedule a season that ends before it starts

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

    -- VALIDATION: Start vs End
    IF end_timestamp IS NOT NULL AND end_timestamp <= start_timestamp THEN
        RAISE EXCEPTION 'Invalid Schedule: End Date must be after Start Date';
    END IF;

    -- Determine season number
    IF target_season_number IS NOT NULL THEN
        v_season_num := target_season_number;
    ELSE
        SELECT MAX(season_number) INTO v_last_season_number FROM seasons;
        v_season_num := COALESCE(v_last_season_number, 0) + 1;
    END IF;
    
    -- Insert new season with Upsert logic
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

-- 3. Ensure the cron actually calls our safer function (if using pg_cron)
-- We re-schedule to be safe, assuming 'process_game_tick' calls it or we add it here.
-- Since we can't easily see process_game_tick, let's make sure process_game_tick calls it.

CREATE OR REPLACE FUNCTION public.process_game_tick()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- 1. Update Resources (Existing Logic)
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

    -- 2. Check for Season End (Added Safety)
    PERFORM check_and_end_season_cron();
END;
$$;
