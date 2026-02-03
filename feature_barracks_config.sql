-- Feature: Barracks Configuration System
-- Manages barracks levels, training costs, and unit base strength

-- 1. Create Configuration Table
CREATE TABLE IF NOT EXISTS public.barracks_configs (
    id SERIAL PRIMARY KEY,
    levels JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of {level, upgrade_cost, stats_per_unit}
    training_costs JSONB NOT NULL DEFAULT '{}'::jsonb, -- {attack: 1000, defense: 1000, spy: 1000, sentry: 1000}
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Populate Default Data (Mirroring src/gameConfig.js and existing logic)
DO $$
DECLARE
    v_levels jsonb := '[]'::jsonb;
    v_training_costs jsonb;
    i int;
BEGIN
    -- Build Barracks Levels (1-10)
    FOR i IN 1..10 LOOP
        v_levels := v_levels || jsonb_build_object(
            'level', i,
            'upgrade_cost', CASE i
                WHEN 1 THEN 0        -- Level 1 is default, no cost
                WHEN 2 THEN 10000
                WHEN 3 THEN 25000
                WHEN 4 THEN 50000
                WHEN 5 THEN 100000
                WHEN 6 THEN 250000
                WHEN 7 THEN 500000
                WHEN 8 THEN 1000000
                WHEN 9 THEN 2500000
                WHEN 10 THEN 5000000
                ELSE 0
            END,
            'stats_per_unit', (i * (i + 1)) / 2  -- Triangular number formula
        );
    END LOOP;

    -- Training Costs (same for all unit types currently)
    v_training_costs := jsonb_build_object(
        'attack', 1000,
        'defense', 1000,
        'spy', 1000,
        'sentry', 1000
    );

    -- Insert or Update
    IF EXISTS (SELECT 1 FROM barracks_configs) THEN
        UPDATE barracks_configs 
        SET levels = v_levels, 
            training_costs = v_training_costs,
            updated_at = NOW();
    ELSE
        INSERT INTO barracks_configs (levels, training_costs) 
        VALUES (v_levels, v_training_costs);
    END IF;
END $$;


-- 3. Function to Get Config
CREATE OR REPLACE FUNCTION get_barracks_config()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN (
        SELECT to_jsonb(c) 
        FROM (
            SELECT levels, training_costs, updated_at 
            FROM barracks_configs 
            LIMIT 1
        ) c
    );
END;
$$;


-- 4. Function to Update Config (Admin Only)
CREATE OR REPLACE FUNCTION update_barracks_config(
    p_levels jsonb,
    p_training_costs jsonb
)
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
    
    UPDATE barracks_configs
    SET levels = p_levels,
        training_costs = p_training_costs,
        updated_at = NOW();
        
    IF NOT FOUND THEN
        INSERT INTO barracks_configs (levels, training_costs) 
        VALUES (p_levels, p_training_costs);
    END IF;
END;
$$;


-- 5. Register Mechanic
INSERT INTO game_mechanics (key, enabled, description) 
VALUES ('barracks_system', true, 'Manage barracks levels, training costs, and unit strength')
ON CONFLICT (key) DO NOTHING;


-- 6. Update upgrade_barracks to use Dynamic Config
CREATE OR REPLACE FUNCTION upgrade_barracks(p_target_level INT)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_current_level int;
    v_gold bigint;
    v_vault bigint;
    v_use_vault boolean;
    v_available_gold bigint;
    v_cost bigint;
    v_config jsonb;
    v_level_config jsonb;
    v_new_stats json;
BEGIN
    -- Get current stats
    SELECT barracks_level, gold, vault, use_vault_gold
    INTO v_current_level, v_gold, v_vault, v_use_vault
    FROM user_stats
    WHERE id = v_user_id;

    v_current_level := COALESCE(v_current_level, 1);

    -- Validate target level
    IF p_target_level IS NULL OR p_target_level = 0 THEN
        p_target_level := v_current_level + 1;
    END IF;

    IF p_target_level != v_current_level + 1 THEN
        RAISE EXCEPTION 'Invalid upgrade target level';
    END IF;

    -- Get Config
    SELECT levels INTO v_config FROM barracks_configs LIMIT 1;
    IF v_config IS NULL THEN
        RAISE EXCEPTION 'Barracks configuration not found';
    END IF;

    -- Find target level config
    SELECT item INTO v_level_config
    FROM jsonb_array_elements(v_config) item
    WHERE (item->>'level')::int = p_target_level;

    IF v_level_config IS NULL THEN
        RAISE EXCEPTION 'Maximum barracks level reached';
    END IF;

    v_cost := (v_level_config->>'upgrade_cost')::bigint;

    -- Calculate available gold
    IF v_use_vault THEN
        v_available_gold := v_gold + v_vault;
    ELSE
        v_available_gold := v_gold;
    END IF;

    IF v_available_gold < v_cost THEN
        RAISE EXCEPTION 'Not enough gold. Need % (Have %)', v_cost, v_available_gold;
    END IF;

    -- Deduct Gold
    IF v_use_vault THEN
        IF v_gold >= v_cost THEN
            UPDATE user_stats
            SET gold = gold - v_cost,
                barracks_level = p_target_level,
                updated_at = NOW()
            WHERE id = v_user_id;
        ELSE
            DECLARE
                v_remainder bigint;
            BEGIN
                v_remainder := v_cost - v_gold;
                UPDATE user_stats
                SET gold = 0,
                    vault = vault - v_remainder,
                    barracks_level = p_target_level,
                    updated_at = NOW()
                WHERE id = v_user_id;
            END;
        END IF;
    ELSE
        UPDATE user_stats
        SET gold = gold - v_cost,
            barracks_level = p_target_level,
            updated_at = NOW()
        WHERE id = v_user_id;
    END IF;

    -- Recalculate Stats
    PERFORM recalculate_user_stats(v_user_id);

    -- Return new stats
    SELECT row_to_json(us) INTO v_new_stats FROM user_stats us WHERE id = v_user_id;
    RETURN v_new_stats;
END;
$$;


-- 7. Update train_units to use Dynamic Config
CREATE OR REPLACE FUNCTION public.train_units(
    p_unit_type text,
    p_quantity int
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_unit_cost bigint;
    v_total_cost bigint;
    v_current_gold bigint;
    v_vault_gold bigint;
    v_use_vault boolean;
    v_available_gold bigint;
    v_current_citizens bigint;
    v_config jsonb;
    v_training_costs jsonb;
    v_new_stats json;
    v_column_name text;
BEGIN
    -- Validate unit type
    IF p_unit_type NOT IN ('attack', 'defense', 'spy', 'sentry') THEN
        RAISE EXCEPTION 'Invalid unit type';
    END IF;

    IF p_quantity <= 0 THEN
        RAISE EXCEPTION 'Quantity must be positive';
    END IF;

    -- Get current stats
    SELECT gold, vault, use_vault_gold, citizens 
    INTO v_current_gold, v_vault_gold, v_use_vault, v_current_citizens
    FROM public.user_stats
    WHERE id = v_user_id;

    IF v_current_citizens < p_quantity THEN
        RAISE EXCEPTION 'Not enough citizens';
    END IF;

    -- Get Config for Cost
    SELECT training_costs INTO v_training_costs FROM barracks_configs LIMIT 1;
    IF v_training_costs IS NULL THEN
        v_unit_cost := 1000; -- Fallback
    ELSE
        v_unit_cost := COALESCE((v_training_costs->>p_unit_type)::bigint, 1000);
    END IF;

    -- Calculate total cost
    v_total_cost := p_quantity * v_unit_cost;

    -- Determine available gold
    IF v_use_vault THEN
        v_available_gold := v_current_gold + v_vault_gold;
    ELSE
        v_available_gold := v_current_gold;
    END IF;

    IF v_available_gold < v_total_cost THEN
         RAISE EXCEPTION 'Not enough gold. Need % (Have %)', v_total_cost, v_available_gold;
    END IF;

    -- Determine column name for soldier type
    v_column_name := CASE p_unit_type
        WHEN 'attack' THEN 'attack_soldiers'
        WHEN 'defense' THEN 'defense_soldiers'
        WHEN 'spy' THEN 'spies'
        WHEN 'sentry' THEN 'sentries'
    END;

    -- Deduct Gold and Train Units
    IF v_use_vault THEN
        IF v_current_gold >= v_total_cost THEN
            EXECUTE format(
                'UPDATE public.user_stats 
                 SET gold = gold - $1, 
                     citizens = citizens - $2, 
                     %I = %I + $2,
                     updated_at = NOW()
                 WHERE id = $3',
                v_column_name, v_column_name
            ) USING v_total_cost, p_quantity, v_user_id;
        ELSE
            DECLARE
                v_remainder bigint;
            BEGIN
                v_remainder := v_total_cost - v_current_gold;
                EXECUTE format(
                    'UPDATE public.user_stats 
                     SET gold = 0, 
                         vault = vault - $1,
                         citizens = citizens - $2, 
                         %I = %I + $2,
                         updated_at = NOW()
                     WHERE id = $3',
                    v_column_name, v_column_name
                ) USING v_remainder, p_quantity, v_user_id;
            END;
        END IF;
    ELSE
        EXECUTE format(
            'UPDATE public.user_stats 
             SET gold = gold - $1, 
                 citizens = citizens - $2, 
                 %I = %I + $2,
                 updated_at = NOW()
             WHERE id = $3',
            v_column_name, v_column_name
        ) USING v_total_cost, p_quantity, v_user_id;
    END IF;

    -- Recalculate stats
    PERFORM recalculate_user_stats(v_user_id);

    -- Return new stats
    SELECT row_to_json(us) INTO v_new_stats
    FROM public.user_stats us
    WHERE id = v_user_id;

    RETURN v_new_stats;
END;
$$;


-- 8. Update calculate_weapon_strength to use Dynamic Config
CREATE OR REPLACE FUNCTION calculate_weapon_strength(
    p_user_id UUID,
    p_weapon_type TEXT,
    p_soldier_count INTEGER
)
RETURNS BIGINT AS $$
DECLARE
    v_barracks_level INTEGER;
    v_base_strength INTEGER;
    v_total_strength BIGINT := 0;
    v_remaining_soldiers INTEGER := p_soldier_count;
    v_weapon RECORD;
    v_weapon_strength INTEGER;
    v_count INTEGER;
    v_config jsonb;
    v_level_config jsonb;
BEGIN
    IF p_soldier_count <= 0 THEN
        RETURN 0;
    END IF;

    -- Get Barracks Level
    SELECT COALESCE(barracks_level, 1) INTO v_barracks_level
    FROM user_stats
    WHERE id = p_user_id;

    -- Get Base Strength from Config
    SELECT levels INTO v_config FROM barracks_configs LIMIT 1;
    IF v_config IS NULL THEN
        -- Fallback to triangular formula
        v_base_strength := (v_barracks_level * (v_barracks_level + 1)) / 2;
    ELSE
        SELECT item INTO v_level_config
        FROM jsonb_array_elements(v_config) item
        WHERE (item->>'level')::int = v_barracks_level;

        IF v_level_config IS NULL THEN
            v_base_strength := (v_barracks_level * (v_barracks_level + 1)) / 2;
        ELSE
            v_base_strength := (v_level_config->>'stats_per_unit')::int;
        END IF;
    END IF;

    -- Get weapons for this type, ordered by tier (best first)
    FOR v_weapon IN 
        SELECT tier, quantity 
        FROM user_weapons 
        WHERE user_id = p_user_id 
        AND weapon_type = p_weapon_type 
        ORDER BY tier DESC
    LOOP
        EXIT WHEN v_remaining_soldiers <= 0;
        
        v_weapon_strength := CASE v_weapon.tier
            WHEN 0 THEN 1
            WHEN 1 THEN 12
            WHEN 2 THEN 150
            WHEN 3 THEN 2000
            WHEN 4 THEN 25000
            WHEN 5 THEN 300000
            ELSE 1
        END;
        
        v_count := LEAST(v_remaining_soldiers, v_weapon.quantity);
        v_total_strength := v_total_strength + (v_count * (v_base_strength + v_weapon_strength));
        v_remaining_soldiers := v_remaining_soldiers - v_count;
    END LOOP;
    
    -- Remaining soldiers without weapons
    IF v_remaining_soldiers > 0 THEN
        v_total_strength := v_total_strength + (v_remaining_soldiers * v_base_strength);
    END IF;
    
    RETURN v_total_strength;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
