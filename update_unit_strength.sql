-- =====================================================
-- UPDATE: Unit Strength Configuration
-- =====================================================
-- This script updates the calculate_weapon_strength function
-- to allow easy changing of the base unit strength.
--
-- CURRENT SETTING: Base Strength = 100
-- TO CHANGE: Edit the 'v_base_strength' variable below.

CREATE OR REPLACE FUNCTION calculate_weapon_strength(
    p_user_id UUID,
    p_weapon_type TEXT,
    p_soldier_count INTEGER
)
RETURNS BIGINT AS $$
DECLARE
    -- CONFIGURATION: Change this value to update unit strength
    v_base_strength CONSTANT INTEGER := 1; 
    
    v_total_strength BIGINT := 0;
    v_remaining_soldiers INTEGER := p_soldier_count;
    v_weapon RECORD;
    v_weapon_strength INTEGER;
    v_count INTEGER;
BEGIN
    -- If no soldiers, return 0
    IF p_soldier_count <= 0 THEN
        RETURN 0;
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
        
        -- Get weapon strength based on tier
        v_weapon_strength := CASE v_weapon.tier
            WHEN 0 THEN 1
            WHEN 1 THEN 12
            WHEN 2 THEN 150
            WHEN 3 THEN 2000
            WHEN 4 THEN 25000
            WHEN 5 THEN 300000
            ELSE 1
        END;
        
        -- Calculate how many soldiers get this weapon
        v_count := LEAST(v_remaining_soldiers, v_weapon.quantity);
        
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recalculate stats for all users to apply the new base strength
DO $$
DECLARE
    v_user RECORD;
BEGIN
    FOR v_user IN SELECT id FROM user_stats LOOP
        PERFORM recalculate_user_stats(v_user.id);
    END LOOP;
END $$;
