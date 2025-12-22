-- rewrite_season_system.sql

-- 1. DROP EVERYTHING related to the old fragile system
DROP FUNCTION IF EXISTS schedule_next_season(TIMESTAMPTZ);
DROP FUNCTION IF EXISTS schedule_next_season(TIMESTAMPTZ, INTEGER);
DROP FUNCTION IF EXISTS schedule_next_season(TIMESTAMPTZ, INTEGER, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS schedule_next_season_v2(TIMESTAMPTZ, INTEGER, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS check_and_end_season_cron();
DROP FUNCTION IF EXISTS activate_pending_season(UUID);
DROP FUNCTION IF EXISTS set_season_end_date(TIMESTAMPTZ);

-- 2. CLEANUP the Game Tick (CRITICAL: REMOVE AUTO-END LOGIC)
-- We strictly remove the call to check_and_end_season_cron
CREATE OR REPLACE FUNCTION public.process_game_tick()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- 1. Update Resources (Standard Logic Only)
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

    -- NOTE: NO SEASON ENDING LOGIC HERE. IT IS MANUAL OR DEDICATED CRON ONLY.
END;
$$;

-- 3. FUNCTION: Create/Schedule a Season (The "Write" Operation)
CREATE OR REPLACE FUNCTION admin_schedule_season(
    p_season_number INTEGER,
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_season_id UUID;
    v_month INT;
    v_year INT;
BEGIN
    -- Admin Check
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true) THEN
        RAISE EXCEPTION 'Access denied: Admin only';
    END IF;

    -- Validation
    IF p_end_date IS NOT NULL AND p_end_date <= p_start_date THEN
        RAISE EXCEPTION 'End date must be after start date';
    END IF;

    v_month := EXTRACT(MONTH FROM p_start_date)::INTEGER;
    v_year := EXTRACT(YEAR FROM p_start_date)::INTEGER;

    -- Upsert Season
    INSERT INTO seasons (
        season_number,
        month,
        year,
        start_date,
        scheduled_end_date,
        is_active
    ) VALUES (
        p_season_number,
        v_month,
        v_year,
        p_start_date,
        p_end_date,
        FALSE -- Always created inactive, waiting for time or manual start
    )
    ON CONFLICT (season_number) 
    DO UPDATE SET
        month = EXCLUDED.month,
        year = EXCLUDED.year,
        start_date = EXCLUDED.start_date,
        scheduled_end_date = EXCLUDED.scheduled_end_date
    RETURNING id INTO v_season_id;

    RETURN v_season_id;
END;
$$;

-- 4. FUNCTION: Start Season NOW (Manual Override)
CREATE OR REPLACE FUNCTION admin_start_season_now(p_season_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Admin Check
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true) THEN
        RAISE EXCEPTION 'Access denied: Admin only';
    END IF;

    -- Deactivate all
    UPDATE seasons SET is_active = FALSE;

    -- Activate Target
    UPDATE seasons 
    SET is_active = TRUE,
        start_date = LEAST(start_date, NOW()) -- Ensure start date is valid (now or past)
    WHERE id = p_season_id;

    RETURN TRUE;
END;
$$;

-- 5. FUNCTION: End Season NOW (Manual Override)
CREATE OR REPLACE FUNCTION admin_end_season_now(p_season_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Admin Check
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true) THEN
        RAISE EXCEPTION 'Access denied: Admin only';
    END IF;

    -- Deactivate Target
    UPDATE seasons 
    SET is_active = FALSE,
        scheduled_end_date = NOW()
    WHERE id = p_season_id;

    RETURN TRUE;
END;
$$;

-- 6. FUNCTION: Get Comprehensive Status (The "Read" Operation)
-- simplifies frontend logic by returning exactly what we need
CREATE OR REPLACE FUNCTION get_admin_season_dashboard()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_active_season JSONB;
    v_next_scheduled JSONB;
    v_last_ended JSONB;
    v_server_time TIMESTAMPTZ;
BEGIN
    v_server_time := NOW();

    -- Get Active
    SELECT to_jsonb(s.*) INTO v_active_season 
    FROM seasons s 
    WHERE s.is_active = TRUE 
    LIMIT 1;

    -- Get Next Scheduled (Future Start)
    SELECT to_jsonb(s.*) INTO v_next_scheduled 
    FROM seasons s 
    WHERE s.is_active = FALSE AND s.start_date > v_server_time 
    ORDER BY s.start_date ASC 
    LIMIT 1;

    -- Get Last Ended (Past Start, Inactive)
    SELECT to_jsonb(s.*) INTO v_last_ended 
    FROM seasons s 
    WHERE s.is_active = FALSE AND s.start_date <= v_server_time 
    ORDER BY s.start_date DESC 
    LIMIT 1;

    RETURN jsonb_build_object(
        'active', v_active_season,
        'next', v_next_scheduled,
        'last', v_last_ended,
        'server_time', v_server_time
    );
END;
$$;

-- 7. Grant Permissions
GRANT EXECUTE ON FUNCTION get_admin_season_dashboard() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_schedule_season(INTEGER, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_start_season_now(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_end_season_now(UUID) TO authenticated;

-- 8. Clean up any weird state caused by previous bugs
-- If there is a season that "Started" recently (last 1 hour) but is set to inactive, let's REACTIVATE it to save the day.
UPDATE seasons 
SET is_active = TRUE 
WHERE is_active = FALSE 
  AND start_date > (NOW() - INTERVAL '1 hour')
  AND start_date < (NOW() + INTERVAL '1 minute')
  AND (scheduled_end_date IS NULL OR scheduled_end_date > NOW());

-- 9. Reload Schema
NOTIFY pgrst, 'reload schema';
