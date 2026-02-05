-- Comprehensive Resource Generation Fix
-- Ensures all resources (turns, vault gold, exp, main treasury gold) are calculated correctly
-- Uses dynamic configuration functions for all calculations

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
    
    -- =====================================================
    -- CITIZEN GENERATION (Dynamic from kingdom_configs)
    -- =====================================================
    -- Try to get from kingdom_configs table, fallback to simple calculation
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
    
    -- =====================================================
    -- GOLD GENERATION (Dynamic miner rate from gold_mine_configs)
    -- =====================================================
    v_untrained_gold := FLOOR(COALESCE(v_stats.citizens, 0) * 1) * v_minutes_passed;
    
    v_trained_count := COALESCE(v_stats.attack_soldiers, 0) + 
                       COALESCE(v_stats.defense_soldiers, 0) + 
                       COALESCE(v_stats.spies, 0) + 
                       COALESCE(v_stats.sentries, 0);
    v_trained_gold := FLOOR(v_trained_count * 0.5) * v_minutes_passed;
    
    -- Try to get miner rate from gold_mine_configs, fallback to calculation
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
    
    -- =====================================================
    -- VAULT INTEREST (Dynamic from calculate_vault_interest function)
    -- =====================================================
    v_vault_level := COALESCE(v_stats.vault_level, 0);
    v_vault_capacity := calculate_vault_capacity(v_vault_level);
    
    -- Use the dynamic calculate_vault_interest function
    BEGIN
        v_interest_rate := calculate_vault_interest(v_vault_level);
    EXCEPTION WHEN OTHERS THEN
        -- Fallback to hardcoded calculation
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
    
    -- =====================================================
    -- EXPERIENCE GENERATION (Dynamic from library_levels table)
    -- =====================================================
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
    
    -- =====================================================
    -- TURN GENERATION (Dynamic from get_turns_per_minute function)
    -- =====================================================
    BEGIN
        v_turns_per_min := get_turns_per_minute(COALESCE(v_stats.research_turns_per_min, 0));
    EXCEPTION WHEN OTHERS THEN
        -- Fallback to simple calculation
        v_turns_per_min := 2 + COALESCE(v_stats.research_turns_per_min, 0);
    END;
    
    v_turn_gain := v_turns_per_min * v_minutes_passed;

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
        last_resource_generation = v_last_regen + (v_minutes_passed * interval '1 minute')
    WHERE id = v_user_id;
    
    -- Return updated stats
    SELECT row_to_json(us) INTO v_result FROM public.user_stats us WHERE id = v_user_id;
    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION generate_resources() TO authenticated;

COMMENT ON FUNCTION generate_resources() IS 'Generates all resources (gold, vault interest, experience, turns, citizens) based on time elapsed since last generation. Uses dynamic configuration from admin-configurable tables.';
