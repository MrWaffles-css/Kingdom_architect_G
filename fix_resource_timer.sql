-- =====================================================
-- FIX: Resource Generation Timing
-- =====================================================
-- Problem: Using 'updated_at' resets the resource timer on every action.
-- Solution: Use a dedicated 'last_resource_generation' column.

-- STEP 1: Add the new column
ALTER TABLE public.user_stats 
ADD COLUMN IF NOT EXISTS last_resource_generation TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- STEP 2: Initialize it for existing users
UPDATE public.user_stats 
SET last_resource_generation = updated_at 
WHERE last_resource_generation IS NULL;

-- STEP 3: Update the generate_resources function
CREATE OR REPLACE FUNCTION public.generate_resources()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_stats RECORD;
    v_now timestamptz;
    v_last_gen timestamptz;
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
    
    -- Calculate time elapsed since LAST RESOURCE GENERATION
    v_last_gen := v_stats.last_resource_generation;
    IF v_last_gen IS NULL THEN
        v_last_gen := v_now;
        -- Initialize if null
        UPDATE public.user_stats SET last_resource_generation = v_now WHERE id = v_user_id;
    END IF;
    
    v_elapsed_seconds := EXTRACT(EPOCH FROM (v_now - v_last_gen));
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
    -- TURN GENERATION
    -- =====================================================
    -- Formula: (2 + research_turns_per_min) turns per minute
    v_turn_gain := (2 + COALESCE(v_stats.research_turns_per_min, 0)) * v_minutes_passed;
    
    -- =====================================================
    -- UPDATE DATABASE
    -- =====================================================
    -- Only update last_resource_generation by the exact amount of minutes processed
    -- This prevents "losing" seconds (e.g. if 61 seconds passed, we process 1 min and keep 1 sec remainder)
    
    UPDATE public.user_stats
    SET 
        citizens = citizens + v_citizen_gain,
        gold = gold + v_gold_gain,
        vault = v_new_vault,
        experience = experience + v_xp_gain,
        turns = turns + v_turn_gain,
        updated_at = v_now,
        last_resource_generation = v_last_gen + (v_minutes_passed * interval '1 minute')
    WHERE id = v_user_id;
    
    -- Return updated stats
    SELECT row_to_json(us) INTO v_result FROM public.user_stats us WHERE id = v_user_id;
    RETURN v_result;
END;
$$;
