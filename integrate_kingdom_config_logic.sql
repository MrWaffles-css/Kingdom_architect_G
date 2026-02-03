-- Integrate Kingdom Configs into Game Logic - CORRECTION

-- Drop function first to allow return type change if needed
DROP FUNCTION IF EXISTS upgrade_kingdom();

-- 1. Update upgrade_kingdom to use dynamic config
CREATE OR REPLACE FUNCTION upgrade_kingdom()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_stats record;
    v_config jsonb;
    v_target_level int;
    v_level_config jsonb;
    v_cost bigint;
    v_exp bigint;
    v_new_stats jsonb;
BEGIN
    -- Get user stats
    SELECT * INTO v_stats FROM user_stats WHERE id = v_user_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'User not found'; END IF;

    -- Get Kingdom Config
    SELECT levels INTO v_config FROM kingdom_configs LIMIT 1;
    IF v_config IS NULL THEN RAISE EXCEPTION 'Kingdom configuration not found'; END IF;

    v_target_level := COALESCE(v_stats.kingdom_level, 0) + 1;

    -- Find config for target level
    SELECT item INTO v_level_config
    FROM jsonb_array_elements(v_config) item
    WHERE (item->>'level')::int = v_target_level;

    IF v_level_config IS NULL THEN
        RAISE EXCEPTION 'Maximum kingdom level reached (Level % configuration missing)', v_target_level;
    END IF;

    v_cost := (v_level_config->>'cost')::bigint;
    v_exp := v_stats.experience;

    IF v_exp < v_cost THEN
        RAISE EXCEPTION 'Insufficient Experience. Need % EXP (Have %)', v_cost, v_exp;
    END IF;

    -- Perform Upgrade
    UPDATE user_stats
    SET experience = experience - v_cost,
        kingdom_level = v_target_level,
        updated_at = NOW()
    WHERE id = v_user_id
    RETURNING * INTO v_stats;

    RETURN to_jsonb(v_stats);
END;
$$;


-- 2. Update process_game_tick to use dynamic Citizen rates
CREATE OR REPLACE FUNCTION public.process_game_tick()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user RECORD;
    v_citizen_gain integer;
    v_gold_gain bigint;
    v_xp_gain bigint;
    v_turn_gain integer;
    v_vault_gain bigint;
    
    -- Gold components
    v_untrained_gold bigint;
    v_trained_gold bigint;
    v_miner_gold bigint;
    v_miner_rate integer;
    v_trained_count integer;
    
    -- Vault components
    v_vault_capacity bigint;
    v_interest_rate numeric;
    v_current_vault bigint;
    v_new_vault bigint;

    -- Config Maps
    v_kingdom_rates jsonb; -- Map of level -> citizens_per_minute
BEGIN
    -- Pre-calculate Kingdom Rates Map for performance
    -- Creates { "1": 1, "2": 2, ... }
    -- Handle existing case where levels might be empty by defaulting to empty object?
    -- Also handle if kingdom_configs is empty.
    SELECT COALESCE(jsonb_object_agg(value->>'level', value->>'citizens_per_minute'), '{}'::jsonb)
    INTO v_kingdom_rates
    FROM kingdom_configs, jsonb_array_elements(levels) value;

    -- Force fallback if null
    IF v_kingdom_rates IS NULL THEN
         v_kingdom_rates := '{}'::jsonb;
    END IF;

    -- Iterate through all users
    FOR v_user IN SELECT * FROM public.user_stats LOOP
        
        -- A. Calculate Gold Production
        -- 1. Untrained Citizens (1 gold each)
        v_untrained_gold := v_user.citizens * 1; 
        
        -- 2. Trained Units (0.5 gold each)
        v_trained_count := v_user.attack_soldiers + v_user.defense_soldiers + v_user.spies + v_user.sentries;
        v_trained_gold := FLOOR(v_trained_count * 0.5); -- Floor to avoid decimals in bigint
        
        -- 3. Miners
        -- Formula: 2 + (level - 1) * 1
        v_miner_rate := 2 + GREATEST(0, v_user.gold_mine_level - 1);
        v_miner_gold := v_user.miners * v_miner_rate;
        
        v_gold_gain := v_untrained_gold + v_trained_gold + v_miner_gold;
        
        -- B. Calculate Vault Interest
        v_current_vault := v_user.vault;
        v_vault_capacity := public.calculate_vault_capacity(v_user.vault_level);
        
        IF v_current_vault >= v_vault_capacity THEN
            v_vault_gain := 0;
            v_new_vault := v_current_vault;
        ELSE
            -- Calculate interest
            v_interest_rate := public.calculate_vault_interest(v_user.vault_level);
            v_vault_gain := FLOOR(v_gold_gain * v_interest_rate);
            v_new_vault := LEAST(v_vault_capacity, v_current_vault + v_vault_gain);
        END IF;
        
        -- C. Calculate Citizen Growth
        -- Use lookup map, default to 0 if level not found (e.g. level 0)
        v_citizen_gain := COALESCE((v_kingdom_rates->>(v_user.kingdom_level::text))::int, 0);
        
        -- D. Experience
        v_xp_gain := GREATEST(1, v_user.library_level);
        
        -- E. Turns
        v_turn_gain := 2 + COALESCE(v_user.research_turns_per_min, 0);
        
        -- UPDATE User
        UPDATE public.user_stats
        SET 
            citizens = citizens + v_citizen_gain,
            gold = gold + v_gold_gain,
            vault = v_new_vault,
            experience = experience + v_xp_gain,
            turns = turns + v_turn_gain,
            updated_at = NOW(),
            last_resource_generation = NOW()
        WHERE id = v_user.id;
        
    END LOOP;
END;
$$;
