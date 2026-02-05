-- Server-Side Resource Generation System
-- Ensures ALL players receive resources every minute, even when offline
-- Critical for multiplayer: Other players can see accurate resources when spying

-- =====================================================
-- STEP 1: Create the Server-Side Tick Function
-- =====================================================
-- This function processes resources for ALL players every minute
CREATE OR REPLACE FUNCTION public.process_game_tick()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user RECORD;
    v_now timestamptz;
    v_last_regen timestamptz;
    v_elapsed_seconds numeric;
    v_minutes_passed integer;
    
    -- Resource gains
    v_citizen_gain integer;
    v_gold_gain bigint;
    v_xp_gain bigint;
    v_turn_gain integer;
    v_vault_gain bigint;
    
    -- Gold generation components
    v_untrained_gold bigint;
    v_trained_gold bigint;
    v_miner_gold bigint;
    v_miner_rate integer;
    v_trained_count integer;
    
    -- Vault calculations
    v_vault_level integer;
    v_interest_rate numeric;
    v_vault_capacity bigint;
    v_current_vault bigint;
    v_new_vault bigint;
    
    -- Dynamic config lookups
    v_lib_rate integer;
    v_turns_per_min integer;
BEGIN
    v_now := NOW();
    
    -- Process each user
    FOR v_user IN SELECT * FROM public.user_stats LOOP
        -- Calculate time elapsed since last generation
        v_last_regen := COALESCE(v_user.last_resource_generation, v_user.updated_at, v_now);
        v_elapsed_seconds := EXTRACT(EPOCH FROM (v_now - v_last_regen));
        v_minutes_passed := FLOOR(v_elapsed_seconds / 60);
        
        -- Skip if less than 1 minute has passed
        IF v_minutes_passed < 1 THEN
            CONTINUE;
        END IF;
        
        -- =====================================================
        -- CITIZEN GENERATION
        -- =====================================================
        BEGIN
            SELECT (item->>'citizens_per_minute')::int INTO v_citizen_gain
            FROM kingdom_configs, jsonb_array_elements(levels) item
            WHERE (item->>'level')::int = COALESCE(v_user.kingdom_level, 0)
            LIMIT 1;
            
            IF v_citizen_gain IS NULL THEN
                v_citizen_gain := FLOOR(COALESCE(v_user.kingdom_level, 0) * 1);
            END IF;
        EXCEPTION WHEN OTHERS THEN
            v_citizen_gain := FLOOR(COALESCE(v_user.kingdom_level, 0) * 1);
        END;
        v_citizen_gain := v_citizen_gain * v_minutes_passed;
        
        -- =====================================================
        -- GOLD GENERATION
        -- =====================================================
        v_untrained_gold := FLOOR(COALESCE(v_user.citizens, 0) * 1) * v_minutes_passed;
        
        v_trained_count := COALESCE(v_user.attack_soldiers, 0) + 
                           COALESCE(v_user.defense_soldiers, 0) + 
                           COALESCE(v_user.spies, 0) + 
                           COALESCE(v_user.sentries, 0);
        v_trained_gold := FLOOR(v_trained_count * 0.5) * v_minutes_passed;
        
        -- Get miner rate from config
        BEGIN
            SELECT (item->>'production_rate')::int INTO v_miner_rate
            FROM gold_mine_configs, jsonb_array_elements(levels) item
            WHERE (item->>'level')::int = COALESCE(v_user.gold_mine_level, 1)
            LIMIT 1;
            
            IF v_miner_rate IS NULL THEN
                v_miner_rate := 2 + GREATEST(0, COALESCE(v_user.gold_mine_level, 1) - 1);
            END IF;
        EXCEPTION WHEN OTHERS THEN
            v_miner_rate := 2 + GREATEST(0, COALESCE(v_user.gold_mine_level, 1) - 1);
        END;
        
        v_miner_gold := COALESCE(v_user.miners, 0) * v_miner_rate * v_minutes_passed;
        v_gold_gain := v_untrained_gold + v_trained_gold + v_miner_gold;
        
        -- =====================================================
        -- VAULT INTEREST
        -- =====================================================
        v_vault_level := COALESCE(v_user.vault_level, 0);
        
        BEGIN
            v_vault_capacity := calculate_vault_capacity(v_vault_level);
            v_interest_rate := calculate_vault_interest(v_vault_level);
        EXCEPTION WHEN OTHERS THEN
            -- Fallback calculations
            IF v_vault_level > 0 THEN
                v_interest_rate := LEAST(0.50, v_vault_level * 0.05);
            ELSE
                v_interest_rate := 0;
            END IF;
            
            v_vault_capacity := CASE
                WHEN v_vault_level = 1 THEN 100000
                WHEN v_vault_level = 2 THEN 500000
                WHEN v_vault_level = 3 THEN 1500000
                WHEN v_vault_level = 4 THEN 5000000
                WHEN v_vault_level = 5 THEN 15000000
                WHEN v_vault_level = 6 THEN 50000000
                WHEN v_vault_level = 7 THEN 150000000
                WHEN v_vault_level = 8 THEN 500000000
                WHEN v_vault_level = 9 THEN 1500000000
                WHEN v_vault_level >= 10 THEN 5000000000
                ELSE 0
            END;
        END;
        
        v_current_vault := COALESCE(v_user.vault, 0);
        
        IF v_current_vault > v_vault_capacity THEN
            v_vault_gain := 0;
            v_new_vault := v_current_vault;
        ELSE
            v_vault_gain := FLOOR(v_gold_gain * v_interest_rate);
            v_new_vault := LEAST(v_vault_capacity, v_current_vault + v_vault_gain);
        END IF;
        
        -- =====================================================
        -- EXPERIENCE GENERATION
        -- =====================================================
        BEGIN
            SELECT xp_rate INTO v_lib_rate 
            FROM public.library_levels 
            WHERE level = COALESCE(v_user.library_level, 1);
            
            IF v_lib_rate IS NULL THEN
                v_lib_rate := COALESCE(v_user.library_level, 1);
            END IF;
        EXCEPTION WHEN OTHERS THEN
            v_lib_rate := COALESCE(v_user.library_level, 1);
        END;
        
        v_xp_gain := v_lib_rate * v_minutes_passed;
        
        -- =====================================================
        -- TURN GENERATION
        -- =====================================================
        BEGIN
            v_turns_per_min := get_turns_per_minute(COALESCE(v_user.research_turns_per_min, 0));
        EXCEPTION WHEN OTHERS THEN
            v_turns_per_min := 2 + COALESCE(v_user.research_turns_per_min, 0);
        END;
        
        v_turn_gain := v_turns_per_min * v_minutes_passed;
        
        -- =====================================================
        -- UPDATE USER STATS
        -- =====================================================
        UPDATE public.user_stats
        SET 
            citizens = citizens + v_citizen_gain,
            gold = gold + v_gold_gain,
            vault = v_new_vault,
            experience = experience + v_xp_gain,
            turns = turns + v_turn_gain,
            last_resource_generation = v_last_regen + (v_minutes_passed * interval '1 minute'),
            updated_at = NOW()
        WHERE id = v_user.id;
        
    END LOOP;
    
    RAISE NOTICE 'Processed game tick for all users at %', v_now;
END;
$$;

GRANT EXECUTE ON FUNCTION process_game_tick() TO postgres;

COMMENT ON FUNCTION process_game_tick() IS 'Server-side function that processes resource generation for ALL players every minute. Ensures resources are always up-to-date for multiplayer interactions (spying, battles, etc).';


-- =====================================================
-- STEP 2: Update generate_resources to be Hybrid
-- =====================================================
-- This allows client-side catch-up while server handles regular ticks
-- The client can call this to immediately catch up if they've been away
CREATE OR REPLACE FUNCTION public.generate_resources()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_stats RECORD;
    v_now timestamptz;
    v_last_regen timestamptz;
    v_elapsed_seconds numeric;
    v_minutes_passed integer;
    
    -- Resource gains
    v_citizen_gain integer;
    v_gold_gain bigint;
    v_xp_gain bigint;
    v_turn_gain integer;
    v_vault_gain bigint;
    
    -- Gold generation components
    v_untrained_gold bigint;
    v_trained_gold bigint;
    v_miner_gold bigint;
    v_miner_rate integer;
    v_trained_count integer;
    
    -- Vault calculations
    v_vault_level integer;
    v_interest_rate numeric;
    v_vault_capacity bigint;
    v_current_vault bigint;
    v_is_over_capacity boolean;
    v_new_vault bigint;
    
    -- Dynamic config lookups
    v_mine_config jsonb;
    v_lib_rate integer;
    v_turns_per_min integer;
    
    v_result json;
BEGIN
    v_user_id := auth.uid();
    v_now := NOW();
    
    -- Get current stats
    SELECT * INTO v_stats FROM public.user_stats WHERE id = v_user_id;
    
    IF v_stats IS NULL THEN
        RAISE EXCEPTION 'User stats not found';
    END IF;
    
    -- Calculate time elapsed since last REGEN (not updated_at)
    v_last_regen := COALESCE(v_stats.last_resource_generation, v_stats.updated_at, v_now);
    
    v_elapsed_seconds := EXTRACT(EPOCH FROM (v_now - v_last_regen));
    v_minutes_passed := FLOOR(v_elapsed_seconds / 60);
    
    -- If less than 1 minute has passed, return current stats
    IF v_minutes_passed < 1 THEN
        SELECT row_to_json(us) INTO v_result FROM public.user_stats us WHERE id = v_user_id;
        RETURN v_result;
    END IF;
    
    -- [Same resource calculation logic as before - using dynamic configs]
    -- CITIZEN GENERATION
    BEGIN
        SELECT (item->>'citizens_per_minute')::int INTO v_citizen_gain
        FROM kingdom_configs, jsonb_array_elements(levels) item
        WHERE (item->>'level')::int = COALESCE(v_stats.kingdom_level, 0)
        LIMIT 1;
        
        IF v_citizen_gain IS NULL THEN
            v_citizen_gain := FLOOR(COALESCE(v_stats.kingdom_level, 0) * 1);
        END IF;
    EXCEPTION WHEN OTHERS THEN
        v_citizen_gain := FLOOR(COALESCE(v_stats.kingdom_level, 0) * 1);
    END;
    v_citizen_gain := v_citizen_gain * v_minutes_passed;
    
    -- GOLD GENERATION
    v_untrained_gold := FLOOR(COALESCE(v_stats.citizens, 0) * 1) * v_minutes_passed;
    
    v_trained_count := COALESCE(v_stats.attack_soldiers, 0) + 
                       COALESCE(v_stats.defense_soldiers, 0) + 
                       COALESCE(v_stats.spies, 0) + 
                       COALESCE(v_stats.sentries, 0);
    v_trained_gold := FLOOR(v_trained_count * 0.5) * v_minutes_passed;
    
    BEGIN
        SELECT (item->>'production_rate')::int INTO v_miner_rate
        FROM gold_mine_configs, jsonb_array_elements(levels) item
        WHERE (item->>'level')::int = COALESCE(v_stats.gold_mine_level, 1)
        LIMIT 1;
        
        IF v_miner_rate IS NULL THEN
            v_miner_rate := 2 + GREATEST(0, COALESCE(v_stats.gold_mine_level, 1) - 1);
        END IF;
    EXCEPTION WHEN OTHERS THEN
        v_miner_rate := 2 + GREATEST(0, COALESCE(v_stats.gold_mine_level, 1) - 1);
    END;
    
    v_miner_gold := COALESCE(v_stats.miners, 0) * v_miner_rate * v_minutes_passed;
    v_gold_gain := v_untrained_gold + v_trained_gold + v_miner_gold;
    
    -- VAULT INTEREST
    v_vault_level := COALESCE(v_stats.vault_level, 0);
    v_vault_capacity := calculate_vault_capacity(v_vault_level);
    
    BEGIN
        v_interest_rate := calculate_vault_interest(v_vault_level);
    EXCEPTION WHEN OTHERS THEN
        IF v_vault_level > 0 THEN
            v_interest_rate := LEAST(0.50, v_vault_level * 0.05);
        ELSE
            v_interest_rate := 0;
        END IF;
    END;
    
    v_current_vault := COALESCE(v_stats.vault, 0);
    v_is_over_capacity := v_current_vault > v_vault_capacity;
    
    IF v_is_over_capacity THEN
        v_vault_gain := 0;
        v_new_vault := v_current_vault; 
    ELSE
        v_vault_gain := FLOOR(v_gold_gain * v_interest_rate);
        v_new_vault := LEAST(v_vault_capacity, v_current_vault + v_vault_gain);
    END IF;
    
    -- EXPERIENCE GENERATION
    BEGIN
        SELECT xp_rate INTO v_lib_rate 
        FROM public.library_levels 
        WHERE level = COALESCE(v_stats.library_level, 1);
        
        IF v_lib_rate IS NULL THEN
            v_lib_rate := COALESCE(v_stats.library_level, 1);
        END IF;
    EXCEPTION WHEN OTHERS THEN
        v_lib_rate := COALESCE(v_stats.library_level, 1);
    END;
    
    v_xp_gain := v_lib_rate * v_minutes_passed;
    
    -- TURN GENERATION
    BEGIN
        v_turns_per_min := get_turns_per_minute(COALESCE(v_stats.research_turns_per_min, 0));
    EXCEPTION WHEN OTHERS THEN
        v_turns_per_min := 2 + COALESCE(v_stats.research_turns_per_min, 0);
    END;
    
    v_turn_gain := v_turns_per_min * v_minutes_passed;

    -- UPDATE DATABASE
    UPDATE public.user_stats
    SET 
        citizens = citizens + v_citizen_gain,
        gold = gold + v_gold_gain,
        vault = v_new_vault,
        experience = experience + v_xp_gain,
        turns = turns + v_turn_gain,
        last_resource_generation = v_last_regen + (v_minutes_passed * interval '1 minute')
    WHERE id = v_user_id;
    
    -- Return updated stats
    SELECT row_to_json(us) INTO v_result FROM public.user_stats us WHERE id = v_user_id;
    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION generate_resources() TO authenticated;


-- =====================================================
-- STEP 3: Schedule the Cron Job
-- =====================================================
-- Remove any existing job first
SELECT cron.unschedule('process_game_tick') WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'process_game_tick'
);

-- Schedule to run every minute
SELECT cron.schedule(
    'process_game_tick',
    '* * * * *',  -- Every minute
    'SELECT public.process_game_tick()'
);

-- Verify the job was created
SELECT jobid, jobname, schedule, command, active 
FROM cron.job 
WHERE jobname = 'process_game_tick';
