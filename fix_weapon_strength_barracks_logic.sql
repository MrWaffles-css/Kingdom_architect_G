-- Fix calculate_weapon_strength to correctly use Barracks Configuration for base strength
-- Previously it was hardcoded to 1, ignoring the barracks level upgrades.

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
    v_weapon_strength BIGINT;
    v_count INTEGER;
    v_config jsonb;
    v_level_config jsonb;
BEGIN
    IF p_soldier_count IS NULL OR p_soldier_count <= 0 THEN
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
            -- Fallback if specific level config missing
            v_base_strength := (v_barracks_level * (v_barracks_level + 1)) / 2;
        ELSE
            v_base_strength := (v_level_config->>'stats_per_unit')::int;
        END IF;
    END IF;

    -- Get weapons for this type, ordered by tier (best first)
    -- Joining with game_weapon_configs to get strength data
    FOR v_weapon IN 
        SELECT uw.tier, uw.quantity, gwc.strength as config_strength
        FROM user_weapons uw
        JOIN game_weapon_configs gwc ON uw.weapon_type = gwc.weapon_type AND uw.tier = gwc.tier
        WHERE uw.user_id = p_user_id 
        AND uw.weapon_type = p_weapon_type 
        ORDER BY uw.tier DESC
    LOOP
        EXIT WHEN v_remaining_soldiers <= 0;
        
        v_weapon_strength := v_weapon.config_strength;
        
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
