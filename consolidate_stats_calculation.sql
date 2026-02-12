-- Consolidate stats calculation to a single robust function
-- This replaces ambiguous calculate_weapon_strength functions with a single BIGINT version
-- that uses config tables (game_weapon_configs, barracks_configs).
-- Also updates recalculate_user_stats to use BIGINT variables.

-- Drop existing functions to remove ambiguity
DROP FUNCTION IF EXISTS calculate_weapon_strength(uuid, text, int);
DROP FUNCTION IF EXISTS calculate_weapon_strength(uuid, text, bigint);

-- Create the robust function
CREATE OR REPLACE FUNCTION calculate_weapon_strength(
    p_user_id UUID,
    p_weapon_type TEXT,
    p_soldier_count BIGINT
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_base_strength INTEGER := 1; 
    v_total_strength BIGINT := 0;
    v_remaining_soldiers BIGINT := p_soldier_count;
    v_weapon RECORD;
    v_weapon_strength BIGINT;
    v_count BIGINT;
    v_barracks_level INTEGER;
    v_levels JSONB;
BEGIN
    if p_soldier_count IS NULL OR p_soldier_count <= 0 THEN
        RETURN 0;
    END IF;

    -- Get Barracks Level
    SELECT barracks_level INTO v_barracks_level FROM public.user_stats WHERE id = p_user_id;
    IF v_barracks_level IS NULL THEN v_barracks_level := 1; END IF;

    -- Get Base Strength from Barracks Config
    SELECT levels INTO v_levels FROM public.barracks_configs LIMIT 1;
    
    IF v_levels IS NOT NULL THEN
        SELECT COALESCE((value->>'stats_per_unit')::INTEGER, 1)
        INTO v_base_strength
        FROM jsonb_array_elements(v_levels)
        WHERE (value->>'level')::INTEGER = v_barracks_level;
    END IF;
    
    IF v_base_strength IS NULL THEN
        v_base_strength := 1;
    END IF;

    -- Get weapons for this type, ordered by tier (best first)
    -- Using game_weapon_configs table
    FOR v_weapon IN 
        SELECT uw.tier, uw.quantity, gwc.strength as config_strength
        FROM user_weapons uw
        JOIN game_weapon_configs gwc ON uw.weapon_type = gwc.weapon_type AND uw.tier = gwc.tier
        WHERE uw.user_id = p_user_id 
        AND uw.weapon_type = p_weapon_type 
        ORDER BY uw.tier DESC
    LOOP
        EXIT WHEN v_remaining_soldiers <= 0;
        
        -- Get weapon strength from config
        v_weapon_strength := v_weapon.config_strength;
        
        -- Calculate how many soldiers get this weapon
        v_count := LEAST(v_remaining_soldiers, v_weapon.quantity); -- quantity is int, cast to bigint implicitly? No, quantity is int.
        
        -- Add strength: Unit Base + Weapon Strength
        v_total_strength := v_total_strength + (v_count * (v_base_strength + v_weapon_strength));
        v_remaining_soldiers := v_remaining_soldiers - v_count;
    END LOOP;
    
    -- Remaining soldiers without weapons have base strength
    IF v_remaining_soldiers > 0 THEN
        v_total_strength := v_total_strength + (v_remaining_soldiers * v_base_strength);
    END IF;
    
    RETURN v_total_strength;
END;
$$;

-- Update recalculate_user_stats to use BIGINT variables for soldiers
CREATE OR REPLACE FUNCTION recalculate_user_stats(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
    v_attack_soldiers BIGINT;
    v_defense_soldiers BIGINT;
    v_spies BIGINT;
    v_sentries BIGINT;
    v_attack_strength BIGINT;
    v_defense_strength BIGINT;
    v_spy_strength BIGINT;
    v_sentry_strength BIGINT;
BEGIN
    -- Get current soldier counts (columns are BIGINT)
    SELECT attack_soldiers, defense_soldiers, spies, sentries
    INTO v_attack_soldiers, v_defense_soldiers, v_spies, v_sentries
    FROM user_stats
    WHERE id = p_user_id;

    -- Calculate strengths using the BIGINT weapon calculation function
    v_attack_strength := calculate_weapon_strength(p_user_id, 'attack', COALESCE(v_attack_soldiers, 0));
    v_defense_strength := calculate_weapon_strength(p_user_id, 'defense', COALESCE(v_defense_soldiers, 0));
    v_spy_strength := calculate_weapon_strength(p_user_id, 'spy', COALESCE(v_spies, 0));
    v_sentry_strength := calculate_weapon_strength(p_user_id, 'sentry', COALESCE(v_sentries, 0));

    -- Update user_stats with calculated values
    UPDATE user_stats
    SET 
        attack = v_attack_strength,
        defense = v_defense_strength,
        spy = v_spy_strength,
        sentry = v_sentry_strength,
        last_stat_update = now()
    WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-calculate all users to ensure consistency with new logic
DO $$
DECLARE
    v_user RECORD;
BEGIN
    FOR v_user IN SELECT id FROM user_stats LOOP
        PERFORM recalculate_user_stats(v_user.id);
    END LOOP;
END $$;
