-- UPDATE: Turns Research for Tutorial Flow
-- 1. Updates Upgrade Costs (Level 1 = 1,000 Gold)
-- 2. Updates Turn Generation (Level 0 = 0 Turns)

-- =====================================================
-- 1. Function: Upgrade Turns Per Minute Research
-- =====================================================
CREATE OR REPLACE FUNCTION public.upgrade_research_turns()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_current_gold bigint;
    v_current_level int;
    v_cost bigint;
    v_new_stats json;
BEGIN
    v_user_id := auth.uid();
    
    -- Get current stats
    SELECT gold, research_turns_per_min INTO v_current_gold, v_current_level
    FROM public.user_stats
    WHERE id = v_user_id;

    -- Handle null level (default to 0)
    IF v_current_level IS NULL THEN
        v_current_level := 0;
    END IF;

    -- Check Max Level
    IF v_current_level >= 5 THEN
        RAISE EXCEPTION 'Max research level reached';
    END IF;

    -- Calculate Gold Cost for NEXT level (Tutorial Curve)
    -- Level 0 -> 1: 1,000 (Start generating turns)
    -- Level 1 -> 2: 5,000
    -- Level 2 -> 3: 25,000
    -- Level 3 -> 4: 100,000
    -- Level 4 -> 5: 500,000

    IF v_current_level = 0 THEN v_cost := 1000;
    ELSIF v_current_level = 1 THEN v_cost := 5000;
    ELSIF v_current_level = 2 THEN v_cost := 25000;
    ELSIF v_current_level = 3 THEN v_cost := 100000;
    ELSIF v_current_level = 4 THEN v_cost := 500000;
    ELSE
        RAISE EXCEPTION 'Invalid level';
    END IF;

    -- Validation
    IF v_current_gold < v_cost THEN
        RAISE EXCEPTION 'Not enough gold';
    END IF;

    -- Deduct Gold & Upgrade
    UPDATE public.user_stats
    SET gold = gold - v_cost,
        research_turns_per_min = v_current_level + 1
    WHERE id = v_user_id;

    -- Return new stats
    SELECT row_to_json(us) INTO v_new_stats
    FROM public.user_stats us
    WHERE id = v_user_id;

    RETURN v_new_stats;
END;
$$;


-- =====================================================
-- 2. Function: Generate Resources
-- =====================================================
CREATE OR REPLACE FUNCTION public.generate_resources()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_stats RECORD;
    v_now timestamptz;
    v_last_update timestamptz;
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
    
    v_result json;
BEGIN
    v_user_id := auth.uid();
    v_now := NOW();
    
    -- Get current stats
    SELECT * INTO v_stats FROM public.user_stats WHERE id = v_user_id;
    
    IF v_stats IS NULL THEN
        RAISE EXCEPTION 'User stats not found';
    END IF;
    
    -- Calculate time elapsed since last update
    v_last_update := v_stats.updated_at;
    IF v_last_update IS NULL THEN
        v_last_update := v_now;
    END IF;
    
    v_elapsed_seconds := EXTRACT(EPOCH FROM (v_now - v_last_update));
    v_minutes_passed := FLOOR(v_elapsed_seconds / 60);
    
    -- If less than 1 minute has passed, return current stats
    IF v_minutes_passed < 1 THEN
        SELECT row_to_json(us) INTO v_result FROM public.user_stats us WHERE id = v_user_id;
        RETURN v_result;
    END IF;
    
    -- =====================================================
    -- CITIZEN GENERATION
    -- =====================================================
    -- Formula: kingdom_level * 10 citizens per minute
    v_citizen_gain := FLOOR(COALESCE(v_stats.kingdom_level, 0) * 10) * v_minutes_passed;
    
    -- =====================================================
    -- GOLD GENERATION
    -- =====================================================
    -- Untrained Citizens: 1 Gold/min
    v_untrained_gold := FLOOR(COALESCE(v_stats.citizens, 0) * 1) * v_minutes_passed;
    
    -- Trained Units: 0.5 Gold/min
    v_trained_count := COALESCE(v_stats.attack_soldiers, 0) + 
                       COALESCE(v_stats.defense_soldiers, 0) + 
                       COALESCE(v_stats.spies, 0) + 
                       COALESCE(v_stats.sentries, 0);
    v_trained_gold := FLOOR(v_trained_count * 0.5) * v_minutes_passed;
    
    -- Miners: Dynamic Gold/min based on level (2 + (level - 1))
    v_miner_rate := 2 + GREATEST(0, COALESCE(v_stats.gold_mine_level, 1) - 1);
    v_miner_gold := COALESCE(v_stats.miners, 0) * v_miner_rate * v_minutes_passed;
    
    v_gold_gain := v_untrained_gold + v_trained_gold + v_miner_gold;
    
    -- =====================================================
    -- VAULT INTEREST
    -- =====================================================
    v_vault_level := COALESCE(v_stats.vault_level, 0);
    v_interest_rate := 0;
    v_vault_capacity := 0;
    
    IF v_vault_level > 0 THEN
        -- Interest: 5% per level up to 50%
        v_interest_rate := LEAST(0.50, v_vault_level * 0.05);
        
        -- Capacity Logic
        IF v_vault_level = 1 THEN v_vault_capacity := 100000;
        ELSIF v_vault_level = 2 THEN v_vault_capacity := 500000;
        ELSIF v_vault_level = 3 THEN v_vault_capacity := 1500000;
        ELSIF v_vault_level = 4 THEN v_vault_capacity := 5000000;
        ELSIF v_vault_level = 5 THEN v_vault_capacity := 15000000;
        ELSIF v_vault_level = 6 THEN v_vault_capacity := 50000000;
        ELSIF v_vault_level = 7 THEN v_vault_capacity := 150000000;
        ELSIF v_vault_level = 8 THEN v_vault_capacity := 500000000;
        ELSIF v_vault_level = 9 THEN v_vault_capacity := 1500000000;
        ELSIF v_vault_level >= 10 THEN v_vault_capacity := 5000000000;
        END IF;
    END IF;
    
    v_current_vault := COALESCE(v_stats.vault, 0);
    v_is_over_capacity := v_current_vault > v_vault_capacity;
    
    -- Interest is based on Gold Generation (only if vault not over capacity)
    IF v_is_over_capacity THEN
        v_vault_gain := 0;
        v_new_vault := v_current_vault; -- Preserve overflow
    ELSE
        v_vault_gain := FLOOR(v_gold_gain * v_interest_rate);
        v_new_vault := LEAST(v_vault_capacity, v_current_vault + v_vault_gain);
    END IF;
    
    -- =====================================================
    -- EXPERIENCE GENERATION
    -- =====================================================
    -- Formula: library_level * 1 XP per minute
    v_xp_gain := COALESCE(v_stats.library_level, 1) * v_minutes_passed;
    
    -- =====================================================
    -- TURN GENERATION (UPDATED)
    -- =====================================================
    -- Formula: Matches Level EXACTLY.
    -- Level 0 = 0 turns/min
    -- Level 1 = 1 turn/min
    
    -- Specific Lookup based on Design
    -- 0:0, 1:1, 2:2, 3:4, 4:8, 5:15
    DECLARE
        v_turns_per_min int;
        v_res_level int;
    BEGIN
        v_res_level := COALESCE(v_stats.research_turns_per_min, 0);
        
        IF v_res_level = 0 THEN v_turns_per_min := 0;
        ELSIF v_res_level = 1 THEN v_turns_per_min := 1;
        ELSIF v_res_level = 2 THEN v_turns_per_min := 2;
        ELSIF v_res_level = 3 THEN v_turns_per_min := 4;
        ELSIF v_res_level = 4 THEN v_turns_per_min := 8;
        ELSIF v_res_level = 5 THEN v_turns_per_min := 15;
        ELSE v_turns_per_min := 15; -- Cap
        END IF;
        
        v_turn_gain := v_turns_per_min * v_minutes_passed;
    END;

    -- =====================================================
    -- UPDATE DATABASE
    -- =====================================================
    UPDATE public.user_stats
    SET 
        citizens = citizens + v_citizen_gain,
        gold = gold + v_gold_gain,
        vault = v_new_vault,
        experience = experience + v_xp_gain,
        turns = turns + v_turn_gain,
        updated_at = v_now
    WHERE id = v_user_id;
    
    -- Return updated stats
    SELECT row_to_json(us) INTO v_result FROM public.user_stats us WHERE id = v_user_id;
    RETURN v_result;
END;
$$;
