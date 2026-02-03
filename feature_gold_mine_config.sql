-- Feature: Gold Mine Configuration System

-- 1. Create Configuration Table
CREATE TABLE IF NOT EXISTS public.gold_mine_configs (
    id SERIAL PRIMARY KEY,
    levels JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of {level, upgrade_cost, production_rate}
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Populate Default Data (Mirroring src/gameConfig.js)
DO $$
DECLARE
    v_levels jsonb := '[]'::jsonb;
    v_cost bigint;
    v_rate int;
    i int;
BEGIN
    FOR i IN 0..25 LOOP
        -- Calculate Cost
        IF i = 0 THEN v_cost := 1000;
        ELSIF i = 1 THEN v_cost := 5000;
        ELSIF i = 2 THEN v_cost := 15000;
        ELSIF i = 3 THEN v_cost := 45000;
        ELSE v_cost := FLOOR(45000 * POWER(3, i - 3));
        END IF;

        -- Calculate Production Rate
        -- Base 2, +1 per level above 1
        -- Matches gameConfig.js and existing SQL logic
        v_rate := 2 + GREATEST(0, i - 1);

        v_levels := v_levels || jsonb_build_object(
            'level', i,
            'upgrade_cost', v_cost, 
            'production_rate', v_rate
        );
    END LOOP;

    -- Update or Insert
    IF EXISTS (SELECT 1 FROM gold_mine_configs) THEN
        UPDATE gold_mine_configs SET levels = v_levels, updated_at = NOW();
    ELSE
        INSERT INTO gold_mine_configs (levels) VALUES (v_levels);
    END IF;
END $$;


-- 3. Function to Get Config
CREATE OR REPLACE FUNCTION get_gold_mine_config()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN (SELECT to_jsonb(c) FROM (SELECT levels, updated_at FROM gold_mine_configs LIMIT 1) c);
END;
$$;


-- 4. Function to Update Config (Admin Only)
CREATE OR REPLACE FUNCTION update_gold_mine_config(p_levels jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_is_admin BOOLEAN;
BEGIN
    SELECT is_admin INTO v_is_admin FROM profiles WHERE id = v_user_id;
    
    IF NOT COALESCE(v_is_admin, false) THEN
        RAISE EXCEPTION 'Admin access required';
    END IF;
    
    UPDATE gold_mine_configs
    SET levels = p_levels,
        updated_at = NOW();
        
    IF NOT FOUND THEN
        INSERT INTO gold_mine_configs (levels) VALUES (p_levels);
    END IF;
END;
$$;


-- 5. Register Mechanic
INSERT INTO game_mechanics (key, enabled, description) 
VALUES ('gold_mine_system', true, 'Manage gold mine levels and production rates')
ON CONFLICT (key) DO NOTHING;


-- 6. Update upgrade_gold_mine to use Dynamic Config
-- IMPORTANT: Replacing existing logic
CREATE OR REPLACE FUNCTION upgrade_gold_mine()
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
    v_new_stats jsonb;
BEGIN
    -- Get user stats
    SELECT * INTO v_stats FROM user_stats WHERE id = v_user_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'User not found'; END IF;

    -- Get Config
    SELECT levels INTO v_config FROM gold_mine_configs LIMIT 1;
    IF v_config IS NULL THEN RAISE EXCEPTION 'Gold Mine configuration not found'; END IF;

    v_target_level := COALESCE(v_stats.gold_mine_level, 0) + 1;

    -- Find target level config
    -- Note: upgrade_cost in config is for the NEXT level usually, 
    -- but my logic in gameConfig loop was matching index.
    -- Let's trace carefully: 
    -- gameConfig: level 0 has cost 1000. This is "Build Cost" (to reach level 0 from null? No, initial state is lvl 0 but maybe unbuilt?). 
    -- Actually in GoldMine.jsx: "Build Mine" if level 0.
    -- Logic: Current is X. Target is X+1. We need Cost of X defined in config? 
    -- Adjust: In GoldMine.jsx: "currentStats.upgrade_cost". currentStats = levels.find(l => l.level === mineLevel).
    -- This matches the JS logic: if I am level 0, I see level 0's "upgrade_cost" (1000). Paying it gets me to... Level 0? Or Level 1?
    -- CHECK GoldMine.jsx logic again.
    -- "Build Mine" (level 0) -> calls upgrade.
    -- wait, if I am level 0, and I upgrade.
    -- In JS: `nextStats` is level + 1. `handleUpgrade` checks `currentStats.upgrade_cost`.
    -- So if I am level 0, I pay 1000.
    -- Does this make me level 1?
    -- `get_gold_mine_config` loop: level 0 cost 1000.
    -- If I pay 1000, I should become level 1?
    -- Let's assume standard "Upgrade from X to X+1 pays Cost associated with X" logic.
    
    -- Finding the config for CURRENT level to determine UPGRADE cost
    SELECT item INTO v_level_config
    FROM jsonb_array_elements(v_config) item
    WHERE (item->>'level')::int = v_stats.gold_mine_level; -- Current Level

    IF v_level_config IS NULL THEN
        RAISE EXCEPTION 'Maximum level reached (Current Level % configuration missing)', v_stats.gold_mine_level;
    END IF;

    v_cost := (v_level_config->>'upgrade_cost')::bigint;

    IF v_stats.gold < v_cost THEN
        RAISE EXCEPTION 'Insufficient Gold. Need % (Have %)', v_cost, v_stats.gold;
    END IF;

    -- Perform Upgrade
    UPDATE user_stats
    SET gold = gold - v_cost,
        gold_mine_level = gold_mine_level + 1,
        updated_at = NOW()
    WHERE id = v_user_id
    RETURNING * INTO v_stats;

    RETURN to_jsonb(v_stats);
END;
$$;


-- 7. Update process_game_tick to use Dynamic Production Rates
-- This is CRITICAL to keep logic consistent
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
    
    v_untrained_gold bigint;
    v_trained_gold bigint;
    v_miner_gold bigint;
    v_miner_rate integer;
    v_trained_count integer;
    
    v_vault_capacity bigint;
    v_interest_rate numeric;
    v_current_vault bigint;
    v_new_vault bigint;

    v_kingdom_rates jsonb;
    v_mine_rates jsonb; -- Map of level -> production_rate
BEGIN
    -- Pre-calculate Kingdom Rates
    SELECT COALESCE(jsonb_object_agg(value->>'level', value->>'citizens_per_minute'), '{}'::jsonb)
    INTO v_kingdom_rates
    FROM kingdom_configs, jsonb_array_elements(levels) value;

    -- Pre-calculate Mine Rates
    SELECT COALESCE(jsonb_object_agg(value->>'level', value->>'production_rate'), '{}'::jsonb)
    INTO v_mine_rates
    FROM gold_mine_configs, jsonb_array_elements(levels) value;

    -- Fallback safety
    IF v_kingdom_rates IS NULL THEN v_kingdom_rates := '{}'::jsonb; END IF;
    IF v_mine_rates IS NULL THEN v_mine_rates := '{}'::jsonb; END IF;

    FOR v_user IN SELECT * FROM public.user_stats LOOP
        v_untrained_gold := v_user.citizens * 1; 
        
        v_trained_count := v_user.attack_soldiers + v_user.defense_soldiers + v_user.spies + v_user.sentries;
        v_trained_gold := FLOOR(v_trained_count * 0.5);
        
        -- DYNAMIC MINE RATE LOOKUP
        -- If level not in map (e.g. out of bounds), fallback to config default logic or 0?
        -- Let's fallback to calculating it if missing, or just 2.
        v_miner_rate := COALESCE((v_mine_rates->>(v_user.gold_mine_level::text))::int, 2 + GREATEST(0, v_user.gold_mine_level - 1));
        
        v_miner_gold := v_user.miners * v_miner_rate;
        v_gold_gain := v_untrained_gold + v_trained_gold + v_miner_gold;
        
        v_current_vault := v_user.vault;
        v_vault_capacity := public.calculate_vault_capacity(v_user.vault_level);
        
        IF v_current_vault >= v_vault_capacity THEN
            v_vault_gain := 0;
            v_new_vault := v_current_vault;
        ELSE
            v_interest_rate := public.calculate_vault_interest(v_user.vault_level);
            v_vault_gain := FLOOR(v_gold_gain * v_interest_rate);
            v_new_vault := LEAST(v_vault_capacity, v_current_vault + v_vault_gain);
        END IF;
        
        v_citizen_gain := COALESCE((v_kingdom_rates->>(v_user.kingdom_level::text))::int, 0);
        v_xp_gain := GREATEST(1, v_user.library_level);
        v_turn_gain := 2 + COALESCE(v_user.research_turns_per_min, 0);
        
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
